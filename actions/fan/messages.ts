"use server"

import { auth }             from "@/lib/auth"
import { prisma }           from "@/lib/prisma"
import { redirect }         from "next/navigation"
import { pusherServer }     from "@/lib/pusher"
import { redis, redisKeys } from "@/lib/redis"
import { z }                from "zod"
import { MessageType }      from "@prisma/client"

// ── Get fan conversations ─────────────────────────────────────────────────────

export async function getFanConversationsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const conversations = await prisma.conversation.findMany({
        where:   { subscriberId: session.user.id },
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
            creator: {
                select: {
                    id:          true,
                    displayName: true,
                    handle:      true,
                    user:        { select: { image: true } },
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

// ── Get messages in a conversation ────────────────────────────────────────────

export async function getFanMessagesAction(
    conversationId: string,
    params?: { page?: number; limit?: number }
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 30
    const skip  = (page - 1) * limit

    // Verify the fan belongs to this conversation
    const conversation = await prisma.conversation.findFirst({
        where: {
            id:           conversationId,
            subscriberId: session.user.id,
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

    // Clear unread count
    await redis.set(redisKeys.unreadCount(session.user.id, conversationId), 0)

    // Mark unread messages as read
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

    // Notify creator of read receipts
    await pusherServer.trigger(
        `private-conversation-${conversationId}`,
        "messages-read",
        { readBy: session.user.id }
    )

    return {
        messages: messages.reverse(),
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

// ── Send message (fan → creator) ──────────────────────────────────────────────

const SendMessageSchema = z.object({
    conversationId: z.string().min(1),
    type:           z.nativeEnum(MessageType).default("TEXT"),
    content:        z.string().optional(),
    mediaUrl:       z.string().optional(),
    voiceNoteUrl:   z.string().optional(),
    voiceDuration:  z.number().optional(),
})

export async function sendFanMessageAction(
    data: z.infer<typeof SendMessageSchema>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = SendMessageSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { conversationId, type, content, mediaUrl, voiceNoteUrl, voiceDuration } = parsed.data

    if (type === "TEXT"       && !content?.trim())  return { error: "Message cannot be empty."    }
    if (type === "IMAGE"      && !mediaUrl)          return { error: "Image URL is required."      }
    if (type === "VIDEO"      && !mediaUrl)          return { error: "Video URL is required."      }
    if (type === "VOICE_NOTE" && !voiceNoteUrl)      return { error: "Voice note URL is required." }

    // Verify the fan belongs to this conversation
    const conversation = await prisma.conversation.findFirst({
        where: {
            id:           conversationId,
            subscriberId: session.user.id,
        },
        include: {
            creator: { select: { userId: true } },
        },
    })
    if (!conversation) return { error: "Conversation not found." }

    const message = await prisma.message.create({
        data: {
            conversationId,
            senderId: session.user.id,
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

    // Update conversation
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

    const recipientId = conversation.creator.userId

    // Pusher: conversation channel
    await pusherServer.trigger(
        `private-conversation-${conversationId}`,
        "new-message",
        { message }
    )

    // Pusher: creator's personal channel
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

    // Redis unread
    await redis.incr(redisKeys.unreadCount(recipientId, conversationId))
    await redis.incr(redisKeys.totalUnread(recipientId))

    // DB notification for the creator
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

// ── Typing indicator ──────────────────────────────────────────────────────────

export async function sendFanTypingAction(
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

// ── Send message request ──────────────────────────────────────────────────────

const MessageRequestSchema = z.object({
    creatorId: z.string().min(1),
    message:   z.string().min(1, "Message cannot be empty.").max(500),
})

export async function sendMessageRequestAction(
    data: z.infer<typeof MessageRequestSchema>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = MessageRequestSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { creatorId, message } = parsed.data

    // Verify creator exists
    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: { id: true, userId: true, displayName: true },
    })
    if (!creator) return { error: "Creator not found." }

    // Check for existing conversation
    const existingConversation = await prisma.conversation.findFirst({
        where: {
            creatorId:    creator.id,
            subscriberId: session.user.id,
        },
    })
    if (existingConversation) {
        return { error: "You already have a conversation with this creator." }
    }

    // Check for existing pending request
    const existingRequest = await prisma.messageRequest.findFirst({
        where: {
            fromUserId:  session.user.id,
            toCreatorId: creator.id,
            status:      "PENDING",
        },
    })
    if (existingRequest) {
        return { error: "You already have a pending request to this creator." }
    }

    const request = await prisma.messageRequest.create({
        data: {
            fromUserId:  session.user.id,
            toCreatorId: creator.id,
            message,
        },
    })

    // Notify creator via Pusher
    await pusherServer.trigger(
        `private-user-${creator.userId}`,
        "new-message-request",
        {
            requestId: request.id,
            fromUser:  {
                id:        session.user.id,
                firstName: session.user.name?.split(" ")[0] ?? null,
            },
            message,
        }
    )

    // DB notification for the creator
    await prisma.notification.create({
        data: {
            userId: creator.userId,
            type:   "NEW_MESSAGE",
            title:  "New message request",
            body:   message.slice(0, 80),
            href:   "/creator/messages?tab=requests",
        },
    })

    return { success: true, requestId: request.id }
}

// ── Get fan's sent message requests ───────────────────────────────────────────

export async function getFanMessageRequestsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const requests = await prisma.messageRequest.findMany({
        where:   { fromUserId: session.user.id },
        orderBy: { createdAt: "desc" },
        include: {
            toCreator: {
                select: {
                    id:          true,
                    displayName: true,
                    handle:      true,
                    user:        { select: { image: true } },
                },
            },
        },
    })

    return requests
}

// ── Get followed creators (with subscription + conversation + request status) ─

export async function getFollowedCreatorsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const follows = await prisma.follow.findMany({
        where: { userId: session.user.id },
        include: {
            creator: {
                select: {
                    id:          true,
                    displayName: true,
                    handle:      true,
                    user:        { select: { image: true } },
                },
            },
        },
    })

    const creatorIds = follows.map((f) => f.creator.id)

    // Batch-fetch subscriptions (with plan details), conversations, and pending requests
    const [subscriptions, conversations, pendingRequests] = await Promise.all([
        prisma.subscription.findMany({
            where: {
                userId:    session.user.id,
                creatorId: { in: creatorIds },
                status:    "ACTIVE",
            },
            select: {
                creatorId:  true,
                amountPaid: true,
                startedAt:  true,
                expiresAt:  true,
                subscriptionPlan: {
                    select: {
                        id:       true,
                        name:     true,
                        price:    true,
                        interval: true,
                    },
                },
            },
        }),
        prisma.conversation.findMany({
            where: {
                subscriberId: session.user.id,
                creatorId:    { in: creatorIds },
            },
            select: { id: true, creatorId: true },
        }),
        prisma.messageRequest.findMany({
            where: {
                fromUserId:  session.user.id,
                toCreatorId: { in: creatorIds },
                status:      "PENDING",
            },
            select: { toCreatorId: true },
        }),
    ])

    const subscriptionMap = new Map(
        subscriptions.map((s) => [s.creatorId, {
            planName:  s.subscriptionPlan?.name ?? null,
            planPrice: s.subscriptionPlan ? Number(s.subscriptionPlan.price) : null,
            interval:  s.subscriptionPlan?.interval ?? null,
            startedAt: s.startedAt,
            expiresAt: s.expiresAt,
        }])
    )
    const conversationMap = new Map(conversations.map((c) => [c.creatorId, c.id]))
    const pendingSet      = new Set(pendingRequests.map((r) => r.toCreatorId))

    return follows.map((f) => ({
        creator:           f.creator,
        isSubscribed:      subscriptionMap.has(f.creator.id),
        subscription:      subscriptionMap.get(f.creator.id) ?? null,
        conversationId:    conversationMap.get(f.creator.id) ?? null,
        hasPendingRequest: pendingSet.has(f.creator.id),
    }))
}

// ── Start conversation (subscriber → creator, auto-create) ────────────────────

export async function startConversationAction(creatorId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // Verify active subscription
    const subscription = await prisma.subscription.findFirst({
        where: {
            userId:    session.user.id,
            creatorId,
            status:    "ACTIVE",
        },
    })
    if (!subscription) {
        return { error: "You must be subscribed to message this creator directly." }
    }

    // Check for existing conversation
    const existing = await prisma.conversation.findFirst({
        where: {
            creatorId,
            subscriberId: session.user.id,
        },
    })
    if (existing) return { success: true, conversationId: existing.id }

    // Create new conversation
    const conversation = await prisma.conversation.create({
        data: {
            creatorId,
            subscriberId: session.user.id,
        },
    })

    // Notify creator
    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: { userId: true },
    })
    if (creator) {
        await pusherServer.trigger(
            `private-user-${creator.userId}`,
            "new-conversation",
            { conversationId: conversation.id }
        )
    }

    return { success: true, conversationId: conversation.id }
}

// ── Get fan total unread ──────────────────────────────────────────────────────

export async function getFanTotalUnreadAction() {
    const session = await auth()
    if (!session?.user?.id) return 0

    const count = await redis.get<number>(
        redisKeys.totalUnread(session.user.id)
    )
    return count ?? 0
}
