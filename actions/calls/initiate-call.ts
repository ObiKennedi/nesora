// actions/calls/initiate-call.ts
"use server"

import { auth }               from "@/lib/auth"
import { prisma }             from "@/lib/prisma"
import { pusherServer }       from "@/lib/pusher"
import { redirect }           from "next/navigation"
import { z }                  from "zod"
import { CallType, Prisma }   from "@prisma/client"
import { isTopFan }           from "@/lib/top-fans"
import { createNotification } from "@/lib/notifiaction"
import {
    MIN_BALANCE_MINUTES,
    perMinuteRate,
} from "@/lib/calls"
import {
    createCallRoom,
    createMeetingToken,
    deleteRoom,
    generateCallRoomName,
} from "@/lib/daily"

const InitiateCallSchema = z.object({
    conversationId: z.string().min(1),
    type:           z.nativeEnum(CallType),
})

export type InitiateCallResult =
    | {
        success: true
        call: {
            id:          string
            type:        CallType
            isFreeCall:  boolean
            ratePerHour: number
        }
        room: { url: string; token: string }
    }
    | {
        error:     string
        code?:     "INSUFFICIENT_BALANCE" | "CREATOR_UNAVAILABLE" | "BUSY"
        required?: number // ₦ needed to start (INSUFFICIENT_BALANCE only)
        balance?:  number // current wallet balance (INSUFFICIENT_BALANCE only)
    }

export async function initiateCallAction(
    data: z.infer<typeof InitiateCallSchema>,
): Promise<InitiateCallResult> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const parsed = InitiateCallSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }
    const { conversationId, type } = parsed.data

    // ── Conversation membership IS the permission to call ─────────────────
    const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, subscriberId: userId },
        include: {
            creator: {
                select: {
                    id:                  true,
                    userId:              true,
                    displayName:         true,
                    voiceCallsEnabled:   true,
                    videoCallsEnabled:   true,
                    voiceCallRate:       true,
                    videoCallRate:       true,
                    availableForCalls:   true,
                    topFanFreeCallCount: true,
                },
            },
        },
    })
    if (!conversation)                        return { error: "Conversation not found." }
    if (conversation.creator.userId === userId)
        return { error: "You can't call yourself." }

    const creator = conversation.creator

    // ── Creator settings gates ─────────────────────────────────────────────
    const enabled = type === "VOICE" ? creator.voiceCallsEnabled : creator.videoCallsEnabled
    if (!enabled) {
        return {
            error: `${creator.displayName} hasn't enabled ${type === "VOICE" ? "voice" : "video"} calls.`,
            code:  "CREATOR_UNAVAILABLE",
        }
    }
    if (!creator.availableForCalls) {
        return {
            error: `${creator.displayName} isn't available for calls right now.`,
            code:  "CREATOR_UNAVAILABLE",
        }
    }

    // ── Busy checks (both sides) ───────────────────────────────────────────
    const [fanActive, creatorActive] = await Promise.all([
        prisma.call.findFirst({
            where:  { fanId: userId, status: { in: ["RINGING", "IN_PROGRESS"] } },
            select: { id: true },
        }),
        prisma.call.findFirst({
            where:  { creatorId: creator.id, status: { in: ["RINGING", "IN_PROGRESS"] } },
            select: { id: true },
        }),
    ])
    if (fanActive)     return { error: "You already have an active call.",              code: "BUSY" }
    if (creatorActive) return { error: `${creator.displayName} is on another call.`,    code: "BUSY" }

    // ── Rate + top-fan resolution (snapshot semantics) ─────────────────────
    const rawRate     = type === "VOICE" ? creator.voiceCallRate : creator.videoCallRate
    const ratePerHour = new Prisma.Decimal(rawRate ?? 0)
    const freeRate    = ratePerHour.lte(0)

    const topFan = !freeRate
        ? await isTopFan(creator.id, userId, creator.topFanFreeCallCount)
        : false

    const isFreeCall = freeRate || topFan

    // ── Wallet buffer for paid calls (read-only pre-check; actual debits ──
    // ── later are conditional decrements, so this is UX not enforcement) ──
    if (!isFreeCall) {
        const required = perMinuteRate(ratePerHour).mul(MIN_BALANCE_MINUTES).toDecimalPlaces(2)
        const wallet   = await prisma.userWallet.findUnique({
            where:  { userId },
            select: { balance: true },
        })
        const balance = wallet?.balance ?? new Prisma.Decimal(0)

        if (balance.lt(required)) {
            return {
                error:    `You need at least ₦${Number(required).toLocaleString()} in your wallet to start this call.`,
                code:     "INSUFFICIENT_BALANCE",
                required: Number(required),
                balance:  Number(balance),
            }
        }
    }

    // ── Daily room → Call row → fan token ──────────────────────────────────
    const roomName = generateCallRoomName()

    let room
    try {
        room = await createCallRoom({ roomName, callType: type })
    } catch (err) {
        console.error("[calls] room creation failed:", err)
        return { error: "Couldn't start the call. Please try again." }
    }

    let call
    try {
        call = await prisma.call.create({
            data: {
                conversationId,
                fanId:         userId,
                creatorId:     creator.id,
                type,
                dailyRoomName: room.name,
                dailyRoomUrl:  room.url,
                ratePerHour:   isFreeCall ? new Prisma.Decimal(0) : ratePerHour,
                isFreeCall,
                isTopFanCall:  topFan,
            },
        })
    } catch (err) {
        console.error("[calls] call row creation failed:", err)
        await deleteRoom(room.name).catch(() => {})
        return { error: "Couldn't start the call. Please try again." }
    }

    let fanToken: string
    try {
        fanToken = await createMeetingToken({
            roomName: room.name,
            userId,
            userName: session.user.name ?? "Fan",
            isOwner:  false,
        })
    } catch (err) {
        console.error("[calls] fan token failed:", err)
        await prisma.call.update({ where: { id: call.id }, data: { status: "FAILED", endedAt: new Date() } })
        await deleteRoom(room.name).catch(() => {})
        return { error: "Couldn't start the call. Please try again." }
    }

    // ── Ring the creator ───────────────────────────────────────────────────
    await pusherServer.trigger(
        `private-user-${creator.userId}`,
        "incoming-call",
        {
            callId:         call.id,
            conversationId,
            type,
            isFreeCall,
            ratePerHour:    Number(ratePerHour),
            fan: {
                id:       userId,
                name:     session.user.name  ?? "A fan",
                image:    session.user.image ?? null,
            },
        },
    )

    // Bell entry for the ring (real-time ping already sent above)
    await createNotification({
        userId: creator.userId,
        type:   "INCOMING_CALL",
        title:  `Incoming ${type === "VOICE" ? "voice" : "video"} call`,
        body:   `${session.user.name ?? "A fan"} is calling you`,
        href:   `/creator/messages/${conversationId}`,
        pusher: false,
    })

    return {
        success: true,
        call: {
            id:          call.id,
            type,
            isFreeCall,
            ratePerHour: Number(ratePerHour),
        },
        room: { url: room.url, token: fanToken },
    }
}