// actions/admin/overview.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"
import { startOfMonth, endOfMonth, subMonths, subDays } from "date-fns"

const n = (v: unknown) => Number(v ?? 0)

export async function getAdminOverviewAction() {
    await requireAdmin()

    const now = new Date()
    const thirtyDaysAgo = subDays(now, 30)

    const [
        totalUsers,
        newUsers30d,
        totalCreators,
        verifiedCreators,
        activeSubscriptions,
        liveStreamsNow,

        subsAgg,
        giftsAgg,
        tipsAgg,
        postPurchasesAgg,
        callsAgg,

        withdrawalFeesAgg,
        callFeesAgg,
        paidOutAgg,

        pendingWithdrawals,
        pendingKyc,
        suspendedUsers,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.creator.count(),
        prisma.creator.count({ where: { isVerified: true } }),
        prisma.subscription.count({ where: { status: "ACTIVE" } }),
        prisma.liveStream.count({ where: { status: "LIVE" } }),

        prisma.subscription.aggregate({ _sum: { amountPaid: true } }),
        prisma.giftTransaction.aggregate({ _sum: { amount: true } }),
        prisma.tip.aggregate({ _sum: { amount: true } }),
        prisma.postPurchase.aggregate({ _sum: { amount: true } }),
        prisma.call.aggregate({ where: { status: "ENDED" }, _sum: { billedAmount: true } }),

        prisma.withdrawal.aggregate({ where: { status: "PAID" }, _sum: { platformFee: true } }),
        prisma.call.aggregate({ where: { status: "ENDED" }, _sum: { platformFee: true } }),
        prisma.withdrawal.aggregate({ where: { status: "PAID" }, _sum: { netAmount: true } }),

        prisma.withdrawal.aggregate({
            where: { status: "PENDING" },
            _sum: { netAmount: true },
            _count: true,
        }),
        prisma.creatorVerification.count({ where: { status: "PENDING" } }),
        prisma.user.count({ where: { isSuspended: true } }),
    ])

    const grossVolume =
        n(subsAgg._sum.amountPaid) +
        n(giftsAgg._sum.amount) +
        n(tipsAgg._sum.amount) +
        n(postPurchasesAgg._sum.amount) +
        n(callsAgg._sum.billedAmount)

    // ── 6-month volume chart ──────────────────────────────────────────────────
    const months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(now, 5 - i)
        return {
            label: date.toLocaleDateString("en-NG", { month: "short" }),
            start: startOfMonth(date),
            end:   endOfMonth(date),
        }
    })

    const chart = await Promise.all(
        months.map(async ({ label, start, end }) => {
            const range = { gte: start, lte: end }
            const [subs, gifts, tips, purchases, calls] = await Promise.all([
                prisma.subscription.aggregate({ where: { createdAt: range }, _sum: { amountPaid: true } }),
                prisma.giftTransaction.aggregate({ where: { createdAt: range }, _sum: { amount: true } }),
                prisma.tip.aggregate({ where: { createdAt: range }, _sum: { amount: true } }),
                prisma.postPurchase.aggregate({ where: { createdAt: range }, _sum: { amount: true } }),
                prisma.call.aggregate({ where: { status: "ENDED", endedAt: range }, _sum: { billedAmount: true } }),
            ])
            return {
                month:         label,
                subscriptions: n(subs._sum.amountPaid),
                gifts:         n(gifts._sum.amount),
                tips:          n(tips._sum.amount),
                content:       n(purchases._sum.amount),
                calls:         n(calls._sum.billedAmount),
            }
        }),
    )

    return {
        stats: {
            totalUsers,
            newUsers30d,
            totalCreators,
            verifiedCreators,
            activeSubscriptions,
            liveStreamsNow,
            suspendedUsers,

            grossVolume,
            feesCollected: n(withdrawalFeesAgg._sum.platformFee) + n(callFeesAgg._sum.platformFee),
            totalPaidOut:  n(paidOutAgg._sum.netAmount),
        },
        queues: {
            pendingWithdrawalCount:  pendingWithdrawals._count,
            pendingWithdrawalAmount: n(pendingWithdrawals._sum.netAmount),
            pendingKycCount:         pendingKyc,
        },
        chart,
    }
}