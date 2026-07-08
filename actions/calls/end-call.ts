// actions/calls/end-call.ts
"use server"

import { auth }         from "@/lib/auth"
import { prisma }       from "@/lib/prisma"
import { pusherServer } from "@/lib/pusher"
import { redirect }     from "next/navigation"
import { deleteRoom }   from "@/lib/daily"
import { Prisma } from "@prisma/client"
import {
    settleCallBilling,
    callEventContent,
    createCallEventMessage,
    finalizeUnansweredCall,
} from "@/lib/calls"

export type EndCallResult =
    | {
        success: true
        summary: {
            status:          "ENDED" | "MISSED" | "DECLINED"
            durationMinutes: number
            billedAmount:    number
        }
    }
    | { error: string }

export async function endCallAction(callId: string): Promise<EndCallResult> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
            creator: { select: { userId: true } },
        },
    })
    if (!call) return { error: "Call not found." }

    const isFan     = call.fanId === userId
    const isCreator = call.creator.userId === userId
    if (!isFan && !isCreator) return { error: "Not authorized." }

    // ── Hanging up while still ringing ─────────────────────────────────────
    // Fan cancel ⇒ MISSED (no penalty, creator gets a missed-call entry).
    // Creator hang-up on a ringing call ⇒ same as declining.
    if (call.status === "RINGING") {
        const outcome = isFan ? ("MISSED" as const) : ("DECLINED" as const)
        const done = await finalizeUnansweredCall(callId, outcome)
        if (!done) {
            // Race: it got accepted or swept between our read and the claim.
            // Re-read and fall through to the in-progress path if applicable.
            const fresh = await prisma.call.findUnique({
                where:  { id: callId },
                select: { status: true },
            })
            if (fresh?.status !== "IN_PROGRESS") {
                return { error: "This call has already ended." }
            }
        } else {
            return {
                success: true,
                summary: { status: outcome, durationMinutes: 0, billedAmount: 0 },
            }
        }
    }

    // ── End an in-progress call ────────────────────────────────────────────
    // Atomic claim so double-taps and end-vs-sweeper races settle exactly once.
    const now     = new Date()
    const claimed = await prisma.call.updateMany({
        where: { id: callId, status: "IN_PROGRESS" },
        data:  { status: "ENDED", endedAt: now },
    })

    if (claimed.count === 0) {
        // Someone else ended it — return the recorded summary (idempotent UX)
        const existing = await prisma.call.findUnique({
            where:  { id: callId },
            select: { status: true, startedAt: true, endedAt: true, billedAmount: true },
        })
        if (!existing || existing.status === "RINGING") {
            return { error: "This call has already ended." }
        }
        const mins = existing.startedAt && existing.endedAt
            ? Math.max(1, Math.ceil(
                (existing.endedAt.getTime() - existing.startedAt.getTime()) / 60_000,
              ))
            : 0
        return {
            success: true,
            summary: {
                status:          existing.status === "ENDED" ? "ENDED"
                               : existing.status === "MISSED" ? "MISSED" : "DECLINED",
                durationMinutes: mins,
                billedAmount:    Number(existing.billedAmount),
            },
        }
    }

    // We own the settlement. Final duration: ceil, minimum 1 minute.
    const startedAt    = call.startedAt ?? now
    const totalMinutes = Math.max(1, Math.ceil((now.getTime() - startedAt.getTime()) / 60_000))

    let billedTotal = call.billedAmount
    if (!call.isFreeCall) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                return settleCallBilling(
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
                )
            })
            billedTotal = call.billedAmount.add(result.billedNow)
        } catch (err) {
            // The call is ENDED but the final delta didn't bill.  delta-based
            // watermark (billedMinutes) means a manual re-settle is safe later;
            // per-minute ticks have already captured all but the last minute.
            console.error("[calls] final settlement failed for", call.id, err)
        }
    }

    // ── Chat bubble + summary events ───────────────────────────────────────
    const { content, preview } = callEventContent({
        type:            call.type,
        outcome:         "ENDED",
        durationMinutes: totalMinutes,
        billedAmount:    billedTotal,
    })

    // The party who did NOT hang up gets the unread bump (they may have
    // navigated away already)
    const otherPartyUserId = isFan ? call.creator.userId : call.fanId

    await createCallEventMessage({
        conversationId:  call.conversationId,
        callId:          call.id,
        fanId:           call.fanId,
        content,
        preview,
        unreadForUserId: otherPartyUserId,
    })

    await pusherServer.trigger(
        `private-conversation-${call.conversationId}`,
        "call-ended",
        {
            callId,
            durationMinutes: totalMinutes,
            billedAmount:    Number(billedTotal),
        },
    )

    try {
        await deleteRoom(call.dailyRoomName)
    } catch {
        /* room self-expires */
    }

    return {
        success: true,
        summary: {
            status:          "ENDED",
            durationMinutes: totalMinutes,
            billedAmount:    Number(billedTotal),
        },
    }
}