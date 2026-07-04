"use server"

import { auth }         from "@/lib/auth"
import { prisma }       from "@/lib/prisma"
import { redirect }     from "next/navigation"
import { pusherServer } from "@/lib/pusher"
import { z }            from "zod"

const streamChannel = (streamId: string) => `stream-${streamId}`

export async function getLiveMessagesAction(streamId: string) {
    return prisma.liveStreamMessage.findMany({
        where:   { streamId },
        orderBy: { createdAt: "asc" },
        take:    100,
        select: {
            id: true, content: true, createdAt: true,
            user: { select: { id: true, username: true, firstName: true, image: true } },
        },
    })
}

const SendSchema = z.object({
    streamId: z.string().min(1),
    content:  z.string().trim().min(1).max(300),
})

type SendResult = { error: string } | { success: true }

export async function sendLiveMessageAction(input: z.infer<typeof SendSchema>): Promise<SendResult> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = SendSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const stream = await prisma.liveStream.findUnique({
        where:  { id: parsed.data.streamId },
        select: { id: true, status: true },
    })
    if (!stream) return { error: "Stream not found." }
    if (stream.status === "ENDED") return { error: "This stream has ended." }

    const message = await prisma.liveStreamMessage.create({
        data:   { streamId: parsed.data.streamId, userId: session.user.id, content: parsed.data.content },
        select: {
            id: true, content: true, createdAt: true,
            user: { select: { id: true, username: true, firstName: true, image: true } },
        },
    })

    await pusherServer.trigger(streamChannel(parsed.data.streamId), "chat-message", message)
    return { success: true }
}

export async function getStreamGiftTotalAction(streamId: string) {
    const agg = await prisma.giftTransaction.aggregate({
        where: { liveStreamId: streamId },
        _sum:  { amount: true },
        _count: { id: true },
    })
    return { total: Number(agg._sum.amount ?? 0), count: agg._count.id }
}