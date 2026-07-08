// lib/call-cron.ts

import { prisma }        from "@/lib/prisma"
import { pusherServer }  from "@/lib/pusher"
import { redis }         from "@/lib/redis"
import {
    deleteRoom,
    getRoomPresence,
    getLatestMeetingSession,
    DailyApiError,
} from "@/lib/daily"
import {
    settleCallBilling,
    perMinuteRate,
    callEventContent,
    createCallEventMessage,
    finalizeUnansweredCall,
} from "@/lib/calls"

const TICK_INTERVAL_MS      = 60_000
const LOCK_KEY              = "cron:calls:lock"
const LOCK_TTL_SECONDS      = 50
const RING_TIMEOUT_MS       = 60_000
const JOIN_GRACE_MS         = 90_000
const ABANDON_THRESHOLD_MS  = 2 * 60_000

const emptySinceKey = (callId: string) => `call:emptysince:${callId}`

declare global {
    var __nesoraCallCronStarted: boolean | undefined
}

export function startCallCron() {
    if (globalThis.__nesoraCallCronStarted) return
    globalThis.__nesoraCallCronStarted = true

    setInterval(() => {
        runCallTick().catch((err) => console.error("[call-cron] tick failed:", err))
    }, TICK_INTERVAL_MS)

    console.log("[call-cron] started (60s interval)")
}

export async function runCallTick() {
    try {
        const acquired = await redis.set(LOCK_KEY, Date.now(), {
            nx: true,
            ex: LOCK_TTL_SECONDS,
        })
        if (acquired === null) return
    } catch (err) {
        console.warn("[call-cron] lock unavailable, running unlocked:", err)
    }

    await sweepStaleRings()
    await processInProgressCalls()
}

async function sweepStaleRings() {
    const cutoff = new Date(Date.now() - RING_TIMEOUT_MS)

    const stale = await prisma.call.findMany({
        where:  { status: "RINGING", ringingAt: { lt: cutoff } },
        select: { id: true },
    })

    for (const c of stale) {
        try {
            await finalizeUnansweredCall(c.id, "MISSED")
        } catch (err) {
            console.error("[call-cron] stale-ring sweep failed for", c.id, err)
        }
    }
}

async function processInProgressCalls() {
    const calls = await prisma.call.findMany({
        where:   { status: "IN_PROGRESS" },
        include: { creator: { select: { userId: true } } },
    })

    for (const call of calls) {
        try {
            await processCall(call)
        } catch (err) {
            console.error("[call-cron] processing failed for", call.id, err)
        }
    }
}

type InProgressCall = Awaited<
    ReturnType<typeof prisma.call.findMany<{
        where:   { status: "IN_PROGRESS" }
        include: { creator: { select: { userId: true } } }
    }>>
>[number]

async function processCall(call: InProgressCall) {
    const now = Date.now()

    if (!call.startedAt) {
        // Should be impossible for IN_PROGRESS — repair defensively
        console.warn("[call-cron] IN_PROGRESS without startedAt:", call.id)
        await prisma.call.update({
            where: { id: call.id },
            data:  { startedAt: new Date() },
        })
        return
    }

    const elapsedMs = now - call.startedAt.getTime()

    if (elapsedMs > JOIN_GRACE_MS) {
        const empty = await isRoomEmpty(call.dailyRoomName)

        if (empty) {
            let emptySince: number | null = null
            try {
                emptySince = await redis.get<number>(emptySinceKey(call.id))
            } catch { /* treat as first sighting */ }

            if (emptySince === null) {
                try {
                    await redis.set(emptySinceKey(call.id), now, { ex: 3600 })
                } catch { /* next tick retries */ }
            } else if (now - emptySince > ABANDON_THRESHOLD_MS) {
                await endCallBySystem(call, "abandoned")
                return
            }
        } else {
            try {
                await redis.del(emptySinceKey(call.id))
            } catch { /* stale key expires on its own */ }
        }
    }

    if (call.isFreeCall) return

    const elapsedMinutes = Math.floor(elapsedMs / 60_000)
    if (elapsedMinutes <= call.billedMinutes) return

    const result = await prisma.$transaction(async (tx) =>
        settleCallBilling(
            tx,
            {
                id:            call.id,
                fanId:         call.fanId,
                creatorId:     call.creatorId,
                ratePerHour:   call.ratePerHour,
                billedMinutes: call.billedMinutes,
                isFreeCall:    call.isFreeCall,
            },
            elapsedMinutes,
        ),
    )

    if (!result.fullyPaid) {
        await endCallBySystem(call, "insufficient-balance")
        return
    }

    const wallet = await prisma.userWallet.findUnique({
        where:  { userId: call.fanId },
        select: { balance: true },
    })
    const nextMinuteCost = perMinuteRate(call.ratePerHour).toDecimalPlaces(2)

    if (!wallet || wallet.balance.lt(nextMinuteCost)) {
        await pusherServer.trigger(
            `private-conversation-${call.conversationId}`,
            "call-ending-low-balance",
            {
                callId:  call.id,
                balance: Number(wallet?.balance ?? 0),
            },
        )
    }
}

async function isRoomEmpty(roomName: string): Promise<boolean> {
    try {
        const presence = await getRoomPresence(roomName)
        return presence.total_count === 0
    } catch (err) {
        if (err instanceof DailyApiError && err.status === 404) return true
        console.warn("[call-cron] presence check failed for", roomName, err)
        return false
    }
}

type EndReason = "insufficient-balance" | "abandoned"

async function endCallBySystem(call: InProgressCall, reason: EndReason) {
    const now = new Date()

    const claimed = await prisma.call.updateMany({
        where: { id: call.id, status: "IN_PROGRESS" },
        data:  { status: "ENDED", endedAt: now },
    })
    if (claimed.count === 0) return

    const startedAt = call.startedAt ?? now

    let totalMinutes = Math.max(1, Math.ceil((now.getTime() - startedAt.getTime()) / 60_000))

    if (reason === "abandoned") {
        try {
            const session = await getLatestMeetingSession(call.dailyRoomName)
            if (session && !session.ongoing && session.duration > 0) {
                totalMinutes = Math.max(1, Math.ceil(session.duration / 60))
            }
        } catch {
            /* fall back to wall-clock duration */
        }
    }
    if (!call.isFreeCall) {
        try {
            await prisma.$transaction(async (tx) =>
                settleCallBilling(
                    tx,
                    {
                        id:            call.id,
                        fanId:         call.fanId,
                        creatorId:     call.creatorId,
                        ratePerHour:   call.ratePerHour,
                        billedMinutes: call.billedMinutes,
                        isFreeCall:    call.isFreeCall,
                    },
                    totalMinutes,
                ),
            )
        } catch (err) {
            console.error("[call-cron] system settlement failed for", call.id, err)
        }
    }

    const settled = await prisma.call.findUnique({
        where:  { id: call.id },
        select: { billedAmount: true },
    })
    const billedTotal = settled?.billedAmount ?? call.billedAmount

    const { content, preview } = callEventContent({
        type:            call.type,
        outcome:         "ENDED",
        durationMinutes: totalMinutes,
        billedAmount:    billedTotal,
    })

    await createCallEventMessage({
        conversationId: call.conversationId,
        callId:         call.id,
        fanId:          call.fanId,
        content,
        preview,
        unreadForUserId: reason === "abandoned" ? call.creator.userId : undefined,
    })

    await pusherServer.trigger(
        `private-conversation-${call.conversationId}`,
        "call-ended",
        {
            callId:          call.id,
            durationMinutes: totalMinutes,
            billedAmount:    Number(billedTotal),
            reason,
        },
    )

    try {
        await redis.del(emptySinceKey(call.id))
    } catch { }

    try {
        await deleteRoom(call.dailyRoomName)
    } catch {}
}