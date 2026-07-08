// actions/creator/messages.ts
"use server"

import { auth }          from "@/lib/auth"
import { prisma }        from "@/lib/prisma"
import { redirect }      from "next/navigation"
import { pusherServer }  from "@/lib/pusher"
import { redis, redisKeys } from "@/lib/redis"
import { z }             from "zod"
import { MessageType }   from "@prisma/client"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) throw new Error("Creator profile not found")
    return creator  
}

export async function getConversationsAction(filter?: "all" | "fans" | "subscribers") {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const conversations = await prisma.conversation.findMany({
        where: {
            creatorId: creator.id,
            ...(filter === "subscribers" ? {
                subscriber: { subscriptions: {
                    some: { creatorId: creator.id, status: "ACTIVE" },
                }},
            } : {}),
        },
        orderBy: { lastMessageAt: "desc" },
        include: {
            messages: {
                orderBy: { createdAt: "desc" },
                take:    1,
                select: {
                    id:        true,
                    type:      true,
                    content:   true,
                    isRead:    true,
                    createdAt: true,
                    senderId:  true,
                },
            },
            subscriber: {
                select: {
                    id:        true,
                    username:  true,
                    firstName: true,
                    lastName:  true,
                    image:     true,
                    subscriptions: {
                        where:  { creatorId: creator.id, status: "ACTIVE" },
                        select: { id: true },
                        take:   1,
                    },
                },
            },
        },
    })

    const withUnread = await Promise.all(
        conversations.map(async (conv) => {
            const unread = await redis.get<number>(
                redisKeys.unreadCount(session.user.id, conv.id)
            ) ?? 0
            return { ...conv, unreadCount: unread }
        })
    )

    return withUnread
}

export async function getMessagesAction(
    conversationId: string,
    params?: { page?: number; limit?: number }
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 30
    const skip  = (page - 1) * limit

    const conversation = await prisma.conversation.findFirst({
        where: {
            id: conversationId,
            OR: [
                { creator:    { userId: session.user.id } },
                { subscriberId: session.user.id           },
            ],
        },
    })
    if (!conversation) return { error: "Conversation not found." }

    const [messages, total] = await Promise.all([
        prisma.message.findMany({
            where:   { conversationId },
            orderBy: { createdAt: "desc" },
            skip,
            take:    limit,
            include: {
                sender: {
                    select: {
                        id:        true,
                        username:  true,
                        firstName: true,
                        lastName:  true,
                        image:     true,
                    },
                },
            },
        }),
        prisma.message.count({ where: { conversationId } }),
    ])

    await redis.set(redisKeys.unreadCount(session.user.id, conversationId), 0)
    await prisma.message.updateMany({
        where: {
            conversationId,
            isRead:   false,
            senderId: { not: session.user.id },
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    })

    await pusherServer.trigger(
        `private-conversation-${conversationId}`,
        "messages-read",
        { readBy: session.user.id }
    )

    return {
        messages: messages.reverse(), // oldest first
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

const SendMessageSchema = z.object({
    conversationId: z.string().min(1),
    type:           z.nativeEnum(MessageType).default("TEXT"),
    content:        z.string().optional(),
    mediaUrl:       z.string().optional(),
    voiceNoteUrl:   z.string().optional(),
    voiceDuration:  z.number().optional(),
})

export async function sendMessageAction(
    data: z.infer<typeof SendMessageSchema>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = SendMessageSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { conversationId, type, content, mediaUrl, voiceNoteUrl, voiceDuration } = parsed.data

    if (type === "TEXT"       && !content?.trim())  return { error: "Message cannot be empty."      }
    if (type === "IMAGE"      && !mediaUrl)          return { error: "Image URL is required."        }
    if (type === "VIDEO"      && !mediaUrl)          return { error: "Video URL is required."        }
    if (type === "VOICE_NOTE" && !voiceNoteUrl)      return { error: "Voice note URL is required."   }

    const conversation = await prisma.conversation.findFirst({
        where: {
            id: conversationId,
            OR: [
                { creator:    { userId: session.user.id } },
                { subscriberId: session.user.id           },
            ],
        },
        include: {
            creator:    { select: { userId: true } },
        },
    })
    if (!conversation) return { error: "Conversation not found." }

    const message = await prisma.message.create({
        data: {
            conversationId,
            senderId:     session.user.id,
            type,
            content,
            mediaUrl,
            voiceNoteUrl,
            voiceDuration,
        },
        include: {
            sender: {
                select: {
                    id:        true,
                    username:  true,
                    firstName: true,
                    lastName:  true,
                    image:     true,
                },
            },
        },
    })

    await prisma.conversation.update({
        where: { id: conversationId },
        data: {
            lastMessageAt:   message.createdAt,
            lastMessageText: type === "TEXT"
                ? content?.slice(0, 100)
                : type === "VOICE_NOTE" ? "🎤 Voice note"
                : type === "IMAGE"      ? "📷 Photo"
                : type === "VIDEO"      ? "🎥 Video"
                : "",
        },
    })

    const recipientId = conversation.subscriberId === session.user.id
        ? conversation.creator.userId
        : conversation.subscriberId

    await pusherServer.trigger(
        `private-conversation-${conversationId}`,
        "new-message",
        { message }
    )

    await pusherServer.trigger(
        `private-user-${recipientId}`,
        "new-conversation-message",
        {
            conversationId,
            message: {
                id:        message.id,
                type:      message.type,
                content:   message.content,
                createdAt: message.createdAt,
                sender:    message.sender,
            },
        }
    )

    await redis.incr(redisKeys.unreadCount(recipientId, conversationId))
    await redis.incr(redisKeys.totalUnread(recipientId))

    await prisma.notification.create({
        data: {
            userId: recipientId,
            type:   "NEW_MESSAGE",
            title:  `New message from ${message.sender.firstName ?? "Someone"}`,
            body:   type === "TEXT"
                ? content?.slice(0, 80) ?? ""
                : type === "VOICE_NOTE" ? "Sent you a voice note 🎤"
                : type === "IMAGE"      ? "Sent you a photo 📷"
                : "Sent you a message",
            href: `/creator/messages/${conversationId}`,
        },
    })

    return { success: true, message }
}

export async function sendTypingAction(
    conversationId: string,
    isTyping:       boolean
) {
    const session = await auth()
    if (!session?.user?.id) return

    await pusherServer.trigger(
        `private-conversation-${conversationId}`,
        "typing",
        { userId: session.user.id, isTyping }
    )
}

export async function getMessageRequestsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const requests = await prisma.messageRequest.findMany({
        where:   { toCreatorId: creator.id, status: "PENDING" },
        orderBy: { createdAt: "desc" },
        include: {
            fromUser: {
                select: {
                    id:        true,
                    username:  true,
                    firstName: true,
                    lastName:  true,
                    image:     true,
                },
            },
        },
    })

    return requests
}

export async function acceptMessageRequestAction(requestId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const request = await prisma.messageRequest.findFirst({
        where: { id: requestId, toCreatorId: creator.id, status: "PENDING" },
    })
    if (!request) return { error: "Request not found." }

    const { conversation } = await prisma.$transaction(async (tx) => {
        const conversation = await tx.conversation.create({
            data: {
                creatorId:    creator.id,
                subscriberId: request.fromUserId,
            },
        })

        await tx.messageRequest.update({
            where: { id: requestId },
            data:  { status: "ACCEPTED" },
        })

        await tx.message.create({
            data: {
                conversationId: conversation.id,
                senderId:       request.fromUserId,
                type:           "TEXT",
                content:        request.message,
            },
        })

        await tx.notification.create({
            data: {
                userId: request.fromUserId,
                type:   "NEW_MESSAGE",
                title:  "Your message request was accepted!",
                body:   "You can now send messages directly.",
                href:   `/messages/${conversation.id}`,
            },
        })

        return { conversation }
    })

    await pusherServer.trigger(
        `private-user-${request.fromUserId}`,
        "message-request-accepted",
        { conversationId: conversation.id }
    )

    return { success: true, conversationId: conversation.id }
}

export async function declineMessageRequestAction(requestId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const request = await prisma.messageRequest.findFirst({
        where: { id: requestId, toCreatorId: creator.id },
    })
    if (!request) return { error: "Request not found." }

    await prisma.messageRequest.update({
        where: { id: requestId },
        data:  { status: "DECLINED" },
    })

    return { success: true }
}

export async function getTotalUnreadAction() {
    const session = await auth()
    if (!session?.user?.id) return 0

    const count = await redis.get<number>(
        redisKeys.totalUnread(session.user.id)
    )
    return count ?? 0
}