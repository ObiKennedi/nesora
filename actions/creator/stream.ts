// actions/creator/stream.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"
import {
    ensureCreatorChannel,
    getStreamKeyValue,
    stopChannelStream,
} from "@/lib/ivs"
import { pusherServer } from "@/lib/pusher"
import { getChannelStreamState } from "@/lib/ivs"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) redirect("/onboarding")
    return creator
}

const StartStreamSchema = z.object({
    streamId:         z.string().optional(),
    title:            z.string().min(1, "Give your stream a title").max(120),
    description:      z.string().max(500).optional(),
    thumbnailUrl:     z.string().url().optional(),
    isSubscriberOnly: z.boolean().default(false),
})

const ScheduleStreamSchema = z.object({
    title:            z.string().min(1, "Give your stream a title").max(120),
    description:      z.string().max(500).optional(),
    thumbnailUrl:     z.string().url().optional(),
    isSubscriberOnly: z.boolean().default(false),
    scheduledFor:     z.string().datetime(),
})

export async function startStreamAction(input: z.infer<typeof StartStreamSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = StartStreamSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)

    const alreadyLive = await prisma.liveStream.findFirst({
        where:  { creatorId: creator.id, status: "LIVE" },
        select: { id: true },
    })
    if (alreadyLive) return { error: "You already have a live stream running." }

    let channel
    try {
        channel = await ensureCreatorChannel(creator.id)
    } catch (err) {
        console.error("IVS channel provisioning failed:", err)
        return { error: "Could not set up your live channel. Please try again." }
    }

    const { streamId, title, description, thumbnailUrl, isSubscriberOnly } = parsed.data

    let stream
    if (streamId) {
        const scheduled = await prisma.liveStream.findFirst({
            where: { id: streamId, creatorId: creator.id, status: "SCHEDULED" },
        })
        if (!scheduled) return { error: "Scheduled stream not found." }

        stream = await prisma.liveStream.update({
            where: { id: streamId },
            data:  { title, description, thumbnailUrl, isSubscriberOnly, playbackUrl: channel.playbackUrl },
        })
    } else {
        stream = await prisma.liveStream.create({
            data: {
                creatorId:   creator.id,
                title, description, thumbnailUrl, isSubscriberOnly,
                status:      "SCHEDULED",
                playbackUrl: channel.playbackUrl,
            },
        })
    }

    let streamKey
    try {
        streamKey = await getStreamKeyValue(channel.streamKeyArn)
    } catch (err) {
        console.error("Stream key fetch failed:", err)
        return { error: "Could not retrieve your stream key. Please try again." }
    }

    return {
        success: true,
        stream: { id: stream.id, title: stream.title, playbackUrl: channel.playbackUrl },
        broadcast: {
            ingestEndpoint: channel.ingestEndpoint,
            streamKey,
        },
    }
}

export async function endStreamAction(streamId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const stream = await prisma.liveStream.findFirst({
        where: { id: streamId, creatorId: creator.id },
    })
    if (!stream) return { error: "Stream not found." }
    if (stream.status === "ENDED") return { success: true }

    if (creator.ivsChannelArn) {
        try {
            await stopChannelStream(creator.ivsChannelArn)
        } catch (err) {
            console.error("IVS StopStream failed:", err)
        }
    }

    const ended = await prisma.liveStream.update({
        where: { id: streamId },
        data:  { status: "ENDED", endedAt: new Date() },
    })

    return { success: true, stream: ended }
}

// ── Schedule for later ───────────────────────────────────────────────────────

export async function scheduleStreamAction(input: z.infer<typeof ScheduleStreamSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = ScheduleStreamSchema.safeParse(input)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    if (new Date(parsed.data.scheduledFor) <= new Date()) {
        return { error: "Scheduled time must be in the future." }
    }

    const creator = await getCreatorOrThrow(session.user.id)

    const stream = await prisma.liveStream.create({
        data: {
            creatorId:        creator.id,
            title:            parsed.data.title,
            description:      parsed.data.description,
            thumbnailUrl:     parsed.data.thumbnailUrl,
            isSubscriberOnly: parsed.data.isSubscriberOnly,
            scheduledFor:     new Date(parsed.data.scheduledFor),
            status:           "SCHEDULED",
        },
    })

    return { success: true, streamId: stream.id }
}

export async function getMyStreamsAction(params?: {
    status?: "SCHEDULED" | "LIVE" | "ENDED"
    page?:   number
    limit?:  number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 20
    const skip  = (page - 1) * limit

    const where = {
        creatorId: creator.id,
        ...(params?.status ? { status: params.status } : {}),
    }

    const [streams, total] = await Promise.all([
        prisma.liveStream.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id:               true,
                title:            true,
                thumbnailUrl:     true,
                status:           true,
                isSubscriberOnly: true,
                peakViewers:      true,
                scheduledFor:     true,
                startedAt:        true,
                endedAt:          true,
                createdAt:        true,
                _count:           { select: { gifts: true, messages: true } },
            },
        }),
        prisma.liveStream.count({ where }),
    ])

    return { streams, total, pages: Math.ceil(total / limit), page }
}

export async function pollStreamStatusAction(streamId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const stream = await prisma.liveStream.findFirst({
        where: { id: streamId, creatorId: creator.id },
    })
    if (!stream) return { error: "Stream not found." }
    if (stream.status === "ENDED" || stream.status === "LIVE") {
        return { status: stream.status }
    }
    if (!creator.ivsChannelArn) return { status: stream.status }

    const state = await getChannelStreamState(creator.ivsChannelArn)
    if (!state.live) return { status: stream.status }

    const updated = await prisma.liveStream.update({
        where: { id: stream.id },
        data: {
            status:      "LIVE",
            startedAt:   state.startedAt ?? new Date(),
            ivsStreamId: state.streamId || null,
        },
    })

    await pusherServer.trigger(`creator-${creator.id}-live`, "stream-live", {
        streamId:         updated.id,
        title:            updated.title,
        isSubscriberOnly: updated.isSubscriberOnly,
        startedAt:        updated.startedAt,
    })

    return { status: "LIVE" as const }
}