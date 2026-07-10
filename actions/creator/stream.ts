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
    getChannelStreamState,
} from "@/lib/ivs"
import { pusherServer } from "@/lib/pusher"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) redirect("/onboarding")
    return creator
}

// ─────────────────────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────────────────────

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

// ═════════════════════════════════════════════════════════════════════════════
// STATE TRANSITIONS
//
// A LiveStream row changes status in exactly two places: markStreamLive and
// markStreamEnded. Every writer — the client poll, the IVS EventBridge webhook,
// the creator pressing "End stream" — routes through them.
//
// Both use a conditional `updateMany` rather than read-then-write. Two writers
// racing means the first one matches, the second gets `count === 0` and
// no-ops. Without this, poll + webhook arriving together fire `stream-live`
// twice and every viewer's player reloads.
// ═════════════════════════════════════════════════════════════════════════════

export async function markStreamLive(params: {
    streamId:     string
    creatorId:    string
    startedAt?:   Date | null
    ivsStreamId?: string | null
}): Promise<{ transitioned: boolean }> {
    const { streamId, creatorId, startedAt, ivsStreamId } = params

    // SCHEDULED → LIVE only. Can never resurrect an ENDED stream, which is what
    // protects us from a late EventBridge retry landing after "End stream".
    const { count } = await prisma.liveStream.updateMany({
        where: { id: streamId, status: "SCHEDULED" },
        data: {
            status:      "LIVE",
            startedAt:   startedAt ?? new Date(),
            ivsStreamId: ivsStreamId || null,
        },
    })

    if (count === 0) return { transitioned: false }

    const stream = await prisma.liveStream.findUnique({
        where:  { id: streamId },
        select: { id: true, title: true, isSubscriberOnly: true, startedAt: true },
    })

    if (stream) {
        await pusherServer.trigger(`creator-${creatorId}-live`, "stream-live", {
            streamId:         stream.id,
            title:            stream.title,
            isSubscriberOnly: stream.isSubscriberOnly,
            startedAt:        stream.startedAt,
        })
    }

    return { transitioned: true }
}

export async function markStreamEnded(params: {
    streamId:  string
    creatorId: string
}): Promise<{ transitioned: boolean }> {
    const { streamId, creatorId } = params

    // Either pre-live or live can end. Already-ENDED is a no-op.
    const { count } = await prisma.liveStream.updateMany({
        where: { id: streamId, status: { in: ["SCHEDULED", "LIVE"] } },
        data:  { status: "ENDED", endedAt: new Date() },
    })

    if (count === 0) return { transitioned: false }

    await pusherServer.trigger(`creator-${creatorId}-live`, "stream-ended", {
        streamId,
        endedAt: new Date(),
    })

    return { transitioned: true }
}

// ═════════════════════════════════════════════════════════════════════════════
// CREATOR ACTIONS
// ═════════════════════════════════════════════════════════════════════════════

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
                // Stays SCHEDULED until IVS confirms ingest. The row existing
                // is not the same as the encoder being connected.
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
        success: true as const,
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
        where:  { id: streamId, creatorId: creator.id },
        select: { id: true, status: true },
    })
    if (!stream) return { error: "Stream not found." as const }
    if (stream.status === "ENDED") return { success: true as const }

    // Tell IVS first — if this fails we still want the row ended, otherwise the
    // creator is stuck with a stream they can't clear.
    if (creator.ivsChannelArn) {
        try {
            await stopChannelStream(creator.ivsChannelArn)
        } catch (err) {
            console.error("IVS StopStream failed:", err)
        }
    }

    await markStreamEnded({ streamId: stream.id, creatorId: creator.id })

    return { success: true as const }
}

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

    return { success: true as const, streamId: stream.id }
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

// ═════════════════════════════════════════════════════════════════════════════
// POLL
//
// IVS does not register a stream the moment frames start flowing — ingest
// handshake plus registration takes roughly 5–15 seconds, and GetStream throws
// ChannelNotBroadcasting the whole time. So a single call right after the
// encoder connects ALWAYS reports not-live. The client must keep asking, which
// is what `pending: true` signals.
//
// This runs in every environment. EventBridge cannot reach localhost, and in
// production it can be slow or drop events — the poll is what makes going live
// reliable rather than hopeful.
// ═════════════════════════════════════════════════════════════════════════════

type PollResult =
    | { error: string }
    | { status: "SCHEDULED" | "LIVE" | "ENDED"; pending: boolean }

export async function pollStreamStatusAction(streamId: string): Promise<PollResult> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const stream = await prisma.liveStream.findFirst({
        where:  { id: streamId, creatorId: creator.id },
        select: { id: true, status: true },
    })
    if (!stream) return { error: "Stream not found." }

    // Resolved — nothing left to wait for.
    if (stream.status === "LIVE" || stream.status === "ENDED") {
        return { status: stream.status, pending: false }
    }

    if (!creator.ivsChannelArn) {
        return { status: stream.status, pending: false }
    }

    let state
    try {
        state = await getChannelStreamState(creator.ivsChannelArn)
    } catch (err) {
        // ChannelNotBroadcasting is the expected pre-ingest response, not a
        // failure. Swallow it and let the client keep polling.
        console.error("IVS GetStream failed (will retry):", err)
        return { status: stream.status, pending: true }
    }

    if (!state.live) {
        return { status: stream.status, pending: true }
    }

    await markStreamLive({
        streamId:    stream.id,
        creatorId:   creator.id,
        startedAt:   state.startedAt,
        ivsStreamId: state.streamId,
    })

    return { status: "LIVE", pending: false }
}