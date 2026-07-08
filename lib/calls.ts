import { pusherServer }       from "@/lib/pusher"
import { redis, redisKeys }   from "@/lib/redis"
import { deleteRoom }         from "@/lib/daily"
import { createNotification } from "@/lib/notifiaction"
import { Prisma, CallType }   from "@prisma/client"
import { prisma, type TxClient } from "@/lib/prisma"

export const PLATFORM_FEE_RATE   = new Prisma.Decimal("0.10")
export const MIN_BALANCE_MINUTES = 5
export const RING_TIMEOUT_MS     = 45_000

const D0 = new Prisma.Decimal(0)

export const perMinuteRate = (ratePerHour: Prisma.Decimal | number | string) =>
    new Prisma.Decimal(ratePerHour).div(60)

export async function debitFanWalletUpTo(
    tx:     TxClient,
    userId: string,
    amount: Prisma.Decimal,
): Promise<Prisma.Decimal> {
    if (amount.lte(0)) return D0

    const full = await tx.userWallet.updateMany({
        where: { userId, balance: { gte: amount } },
        data:  { balance: { decrement: amount } },
    })
    if (full.count === 1) return amount

    const wallet = await tx.userWallet.findUnique({
        where:  { userId },
        select: { balance: true },
    })
    if (!wallet || wallet.balance.lte(0)) return D0

    const partial = wallet.balance
    const res = await tx.userWallet.updateMany({
        where: { userId, balance: { gte: partial } },
        data:  { balance: { decrement: partial } },
    })
    return res.count === 1 ? partial : D0
}

export type BillableCall = {
    id:            string
    fanId:         string
    creatorId:     string
    ratePerHour:   Prisma.Decimal
    billedMinutes: number
    isFreeCall:    boolean
}

export type SettlementResult = {
    billedNow:          Prisma.Decimal
    totalBilledMinutes: number
    fullyPaid:          boolean
}

export async function settleCallBilling(
    tx:            TxClient,
    call:          BillableCall,
    targetMinutes: number,
): Promise<SettlementResult> {
    const delta = targetMinutes - call.billedMinutes

    if (call.isFreeCall || delta <= 0) {
        return {
            billedNow:          D0,
            totalBilledMinutes: Math.max(targetMinutes, call.billedMinutes),
            fullyPaid:          true,
        }
    }

    const due     = perMinuteRate(call.ratePerHour).mul(delta).toDecimalPlaces(2)
    const debited = await debitFanWalletUpTo(tx, call.fanId, due)

    if (debited.gt(0)) {
        const fee = debited.mul(PLATFORM_FEE_RATE).toDecimalPlaces(2)
        const net = debited.sub(fee)

        const fanWallet = await tx.userWallet.findUnique({
            where:  { userId: call.fanId },
            select: { id: true },
        })
        if (fanWallet) {
            await tx.userWalletTransaction.create({
                data: {
                    walletId:    fanWallet.id,
                    amount:      debited,
                    type:        "CALL_PAYMENT",
                    description: `Call payment (${delta} min)`,
                },
            })
        }

        // Creator credit — instant, matching the gift/unlock pattern
        const creatorWallet = await tx.creatorWallet.upsert({
            where:  { creatorId: call.creatorId },
            create: { creatorId: call.creatorId, balance: net },
            update: { balance: { increment: net } },
        })
        await tx.creatorWalletTransaction.create({
            data: {
                walletId:    creatorWallet.id,
                amount:      net,
                type:        "CALL_RECEIVED",
                description: `Call earnings (${delta} min)`,
            },
        })

        await tx.call.update({
            where: { id: call.id },
            data: {
                billedMinutes: targetMinutes,
                billedAmount:  { increment: debited },
                platformFee:   { increment: fee },
            },
        })
    } else {
        await tx.call.update({
            where: { id: call.id },
            data:  { billedMinutes: targetMinutes },
        })
    }

    return {
        billedNow:          debited,
        totalBilledMinutes: targetMinutes,
        fullyPaid:          debited.gte(due),
    }
}

export type CallOutcome = "MISSED" | "DECLINED" | "ENDED"

export function callEventContent(params: {
    type:             CallType
    outcome:          CallOutcome
    durationMinutes?: number
    billedAmount?:    Prisma.Decimal
}): { content: string; preview: string } {
    const noun  = params.type === "VOICE" ? "voice call" : "video call"
    const emoji = params.type === "VOICE" ? "📞" : "📹"

    let content: string
    switch (params.outcome) {
        case "MISSED":
            content = `Missed ${noun}`
            break
        case "DECLINED":
            content = `Declined ${noun}`
            break
        case "ENDED": {
            const mins = params.durationMinutes ?? 0
            const base = `${params.type === "VOICE" ? "Voice" : "Video"} call · ${mins} min`
            content = params.billedAmount && params.billedAmount.gt(0)
                ? `${base} · ₦${Number(params.billedAmount).toLocaleString()}`
                : base
            break
        }
    }

    return { content, preview: `${emoji} ${content}` }
}

export async function createCallEventMessage(params: {
    conversationId:   string
    callId:           string
    fanId:            string
    content:          string
    preview:          string
    unreadForUserId?: string
}) {
    const message = await prisma.message.create({
        data: {
            conversationId: params.conversationId,
            senderId:       params.fanId,
            type:           "CALL_EVENT",
            content:        params.content,
            callId:         params.callId,
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
        where: { id: params.conversationId },
        data: {
            lastMessageAt:   message.createdAt,
            lastMessageText: params.preview,
        },
    })

    await pusherServer.trigger(
        `private-conversation-${params.conversationId}`,
        "new-message",
        { message },
    )

    if (params.unreadForUserId) {
        await Promise.all([
            redis.incr(redisKeys.unreadCount(params.unreadForUserId, params.conversationId)),
            redis.incr(redisKeys.totalUnread(params.unreadForUserId)),
            pusherServer.trigger(
                `private-user-${params.unreadForUserId}`,
                "new-conversation-message",
                {
                    conversationId: params.conversationId,
                    message: {
                        id:        message.id,
                        type:      message.type,
                        content:   message.content,
                        createdAt: message.createdAt,
                        sender:    message.sender,
                    },
                },
            ),
        ])
    }

    return message
}

export async function finalizeUnansweredCall(
    callId:  string,
    outcome: "MISSED" | "DECLINED",
): Promise<boolean> {
    const claimed = await prisma.call.updateMany({
        where: { id: callId, status: "RINGING" },
        data:  { status: outcome, endedAt: new Date() },
    })
    if (claimed.count === 0) return false

    const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
            creator: { select: { userId: true } },
            fan:     { select: { firstName: true, username: true } },
        },
    })
    if (!call) return false

    const { content, preview } = callEventContent({ type: call.type, outcome })

    await createCallEventMessage({
        conversationId: call.conversationId,
        callId:         call.id,
        fanId:          call.fanId,
        content,
        preview,
        unreadForUserId: outcome === "MISSED" ? call.creator.userId : undefined,
    })

    await pusherServer.trigger(
        `private-conversation-${call.conversationId}`,
        outcome === "MISSED" ? "call-missed" : "call-declined",
        { callId: call.id },
    )
    await pusherServer.trigger(
        `private-user-${call.creator.userId}`,
        "call-cancelled",
        { callId: call.id },
    )

    if (outcome === "MISSED") {
        const fanName = call.fan.firstName ?? call.fan.username ?? "A fan"
        await createNotification({
            userId: call.creator.userId,
            type:   "MISSED_CALL",
            title:  "Missed call",
            body:   `You missed a ${call.type === "VOICE" ? "voice" : "video"} call from ${fanName}`,
            href:   `/creator/messages/${call.conversationId}`,
            pusher: false,
        })
    }

    try {
        await deleteRoom(call.dailyRoomName)
    } catch {}

    return true
}