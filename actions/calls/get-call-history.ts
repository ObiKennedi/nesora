// actions/calls/get-call-history.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"

export type CallHistoryPerspective = "fan" | "creator"
export type CallHistoryFilter      = "all" | "missed"

export type CallHistoryItem = {
    id:              string
    conversationId:  string
    type:            "VOICE" | "VIDEO"
    status:          "RINGING" | "DECLINED" | "MISSED" | "IN_PROGRESS" | "ENDED" | "FAILED"
    isFreeCall:      boolean
    isTopFanCall:    boolean
    ratePerHour:     number
    /** Gross ₦ the fan paid. Creator net = amount − platformFee. */
    billedAmount:    number
    platformFee:     number
    durationMinutes: number
    createdAt:       Date
    counterpart: {
        name:   string
        handle: string | null
        image:  string | null
    }
}

export type CallHistoryResult = {
    calls: CallHistoryItem[]
    total: number
    pages: number
    page:  number
    /** Creator perspective only */
    stats: {
        totalCalls:    number
        missedCalls:   number
        totalMinutes:  number
        netEarnings:   number
    } | null
}

export async function getCallHistoryAction(params: {
    perspective: CallHistoryPerspective
    filter?:     CallHistoryFilter
    page?:       number
    limit?:      number
}): Promise<CallHistoryResult | { error: string }> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const page   = params.page  ?? 1
    const limit  = params.limit ?? 20
    const skip   = (page - 1) * limit
    const filter = params.filter ?? "all"

    // ── Resolve scope ──────────────────────────────────────────────────────
    let creatorId: string | null = null
    if (params.perspective === "creator") {
        const creator = await prisma.creator.findUnique({
            where:  { userId },
            select: { id: true },
        })
        if (!creator) return { error: "Creator profile not found." }
        creatorId = creator.id
    }

    const where = {
        ...(params.perspective === "fan"
            ? { fanId: userId }
            : { creatorId: creatorId! }),
        ...(filter === "missed" ? { status: "MISSED" as const } : {}),
    }

    // ── Fetch ──────────────────────────────────────────────────────────────
    const [calls, total] = await Promise.all([
        prisma.call.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id:             true,
                conversationId: true,
                type:           true,
                status:         true,
                isFreeCall:     true,
                isTopFanCall:   true,
                ratePerHour:    true,
                billedAmount:   true,
                platformFee:    true,
                startedAt:      true,
                endedAt:        true,
                createdAt:      true,
                creator: {
                    select: {
                        displayName: true,
                        handle:      true,
                        user:        { select: { image: true } },
                    },
                },
                fan: {
                    select: {
                        username:  true,
                        firstName: true,
                        lastName:  true,
                        image:     true,
                    },
                },
            },
        }),
        prisma.call.count({ where }),
    ])

    // ── Creator earnings stats (dashboard header) ──────────────────────────
    let stats: CallHistoryResult["stats"] = null
    if (params.perspective === "creator") {
        const [agg, missedCount, endedCalls] = await Promise.all([
            prisma.call.aggregate({
                where:  { creatorId: creatorId! },
                _sum:   { billedAmount: true, platformFee: true },
                _count: { id: true },
            }),
            prisma.call.count({
                where: { creatorId: creatorId!, status: "MISSED" },
            }),
            prisma.call.findMany({
                where:  { creatorId: creatorId!, status: "ENDED" },
                select: { startedAt: true, endedAt: true },
            }),
        ])

        const totalMinutes = endedCalls.reduce((sum, c) => {
            if (!c.startedAt || !c.endedAt) return sum
            return sum + Math.max(1, Math.ceil(
                (c.endedAt.getTime() - c.startedAt.getTime()) / 60_000,
            ))
        }, 0)

        stats = {
            totalCalls:   agg._count.id,
            missedCalls:  missedCount,
            totalMinutes,
            netEarnings:
                Number(agg._sum.billedAmount ?? 0) - Number(agg._sum.platformFee ?? 0),
        }
    }

    // ── Shape rows ─────────────────────────────────────────────────────────
    return {
        calls: calls.map((c) => {
            const durationMinutes = c.startedAt && c.endedAt && c.status === "ENDED"
                ? Math.max(1, Math.ceil((c.endedAt.getTime() - c.startedAt.getTime()) / 60_000))
                : 0

            const counterpart = params.perspective === "fan"
                ? {
                    name:   c.creator.displayName,
                    handle: c.creator.handle,
                    image:  c.creator.user.image,
                }
                : {
                    name:   [c.fan.firstName, c.fan.lastName].filter(Boolean).join(" ")
                            || c.fan.username || "Anonymous",
                    handle: c.fan.username,
                    image:  c.fan.image,
                }

            return {
                id:             c.id,
                conversationId: c.conversationId,
                type:           c.type,
                status:         c.status,
                isFreeCall:     c.isFreeCall,
                isTopFanCall:   c.isTopFanCall,
                ratePerHour:    Number(c.ratePerHour),
                billedAmount:   Number(c.billedAmount),
                platformFee:    Number(c.platformFee),
                durationMinutes,
                createdAt:      c.createdAt,
                counterpart,
            }
        }),
        total,
        pages: Math.ceil(total / limit),
        page,
        stats,
    }
}