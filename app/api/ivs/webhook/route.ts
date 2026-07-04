// app/api/ivs/webhook/route.ts
import { NextResponse }  from "next/server"
import { prisma }        from "@/lib/prisma"
import { pusherServer }  from "@/lib/pusher"

// Prisma + timing-safe compare need the Node runtime, not edge.
export const runtime  = "nodejs"
export const dynamic  = "force-dynamic"

// ── EventBridge shapes (only the fields we use) ──────────────────────────────
interface IvsEvent {
    "detail-type"?: string
    source?:        string
    time?:          string
    detail?: {
        event_name?:               string  // "Stream Start" | "Stream End" | "Recording End" | ...
        channel_arn?:              string
        stream_id?:                string
        recording_s3_bucket_name?: string
        recording_s3_key_prefix?:  string
    }
}

// Constant-time-ish secret check.
function validSecret(header: string | null): boolean {
    const expected = process.env.IVS_WEBHOOK_SECRET
    if (!expected || !header) return false
    if (header.length !== expected.length) return false
    let mismatch = 0
    for (let i = 0; i < header.length; i++) mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i)
    return mismatch === 0
}

export async function POST(req: Request) {
    // 1. Auth — shared secret set on the EventBridge connection.
    if (!validSecret(req.headers.get("x-webhook-secret"))) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    // 2. Parse.
    let event: IvsEvent
    try {
        event = await req.json()
    } catch {
        return NextResponse.json({ error: "bad json" }, { status: 400 })
    }

    if (event.source !== "aws.ivs") {
        return NextResponse.json({ ok: true, ignored: "not an ivs event" })
    }

    const name       = event.detail?.event_name
    const channelArn = event.detail?.channel_arn
    const streamId   = event.detail?.stream_id
    const at         = event.time ? new Date(event.time) : new Date()

    if (!channelArn) {
        return NextResponse.json({ ok: true, ignored: "no channel_arn" })
    }

    // 3. Resolve the creator from the channel.
    const creator = await prisma.creator.findFirst({
        where:  { ivsChannelArn: channelArn },
        select: { id: true, displayName: true },
    })
    if (!creator) {
        // Unknown channel — ack so EventBridge doesn't retry forever.
        return NextResponse.json({ ok: true, ignored: "unknown channel" })
    }

    try {
        switch (name) {
            case "Stream Start":
                await handleStreamStart(creator, streamId, at)
                break
            case "Stream End":
                await handleStreamEnd(creator.id, at)
                break
            case "Recording End":
                await handleRecordingEnd(event, streamId)
                break
            default:
                // Stream Failure, Recording Start, etc. — ack and move on.
                return NextResponse.json({ ok: true, ignored: name ?? "unnamed" })
        }
    } catch (err) {
        console.error(`IVS webhook error handling "${name}":`, err)
        return NextResponse.json({ error: "processing failed" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
}

async function handleStreamStart(
    creator: { id: string; displayName: string },
    streamId: string | undefined,
    at: Date,
) {

    const pending = await prisma.liveStream.findFirst({
        where:   { creatorId: creator.id, status: "SCHEDULED", playbackUrl: { not: null } },
        orderBy: { updatedAt: "desc" },
    })

    const stream = pending
        ? await prisma.liveStream.update({
              where: { id: pending.id },
              data:  { status: "LIVE", startedAt: at, ivsStreamId: streamId ?? null },
          })
        : await prisma.liveStream.create({
              data: {
                  creatorId:   creator.id,
                  title:       `${creator.displayName} is live`,
                  status:      "LIVE",
                  startedAt:   at,
                  ivsStreamId: streamId ?? null,
              },
          })

    await pusherServer.trigger(`creator-${creator.id}-live`, "stream-live", {
        streamId:         stream.id,
        title:            stream.title,
        isSubscriberOnly: stream.isSubscriberOnly,
        startedAt:        stream.startedAt,
    })

    const followers = await prisma.follow.findMany({
        where:  { creatorId: creator.id },
        select: { userId: true },
    })
    if (followers.length) {
        await prisma.notification.createMany({
            data: followers.map((f) => ({
                userId: f.userId,
                type:   "LIVE_STARTING" as const,
                title:  `${creator.displayName} is live`,
                body:   stream.title,
                href:   `/live/${stream.id}`,
            })),
        })
    }
}

async function handleStreamEnd(creatorId: string, at: Date) {
    const live = await prisma.liveStream.findFirst({
        where:   { creatorId, status: "LIVE" },
        orderBy: { startedAt: "desc" },
    })
    if (!live) return

    const ended = await prisma.liveStream.update({
        where: { id: live.id },
        data:  { status: "ENDED", endedAt: at },
    })

    await pusherServer.trigger(`creator-${creatorId}-live`, "stream-ended", {
        streamId: ended.id,
        endedAt:  ended.endedAt,
    })
}

async function handleRecordingEnd(event: IvsEvent, streamId: string | undefined) {
    const bucket = event.detail?.recording_s3_bucket_name
    const prefix = event.detail?.recording_s3_key_prefix
    if (!bucket || !prefix || !streamId) return

    const recordingUrl = `https://${bucket}.s3.amazonaws.com/${prefix}/media/hls/master.m3u8`

    await prisma.liveStream.updateMany({
        where: { ivsStreamId: streamId },
        data:  { recordingUrl },
    })
}