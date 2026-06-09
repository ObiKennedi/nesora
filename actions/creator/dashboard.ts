// actions/creator/dashboard.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import {
    startOfMonth, startOfWeek,
    endOfMonth, endOfWeek,
} from "date-fns"

export async function getDashboardData() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await prisma.creator.findUnique({
        where: { userId: session.user.id },
        select: {
            id: true,
            displayName: true,
            isVerified: true,
            verificationStatus: true,
            followersCount: true,
            subscribersCount: true,
            pointsBalance: true,
        },
    })

    if (!creator) redirect("/onboarding")

    const now = new Date()
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

    // ── Earnings this month ───────────────────────────────────────────────────
    const [
        subscriptionEarnings,
        giftEarnings,
    ] = await Promise.all([
        prisma.creatorWalletTransaction.aggregate({
            where: {
                wallet: { creatorId: creator.id },
                type: "SUBSCRIPTION_RECEIVED",
                createdAt: { gte: monthStart, lte: monthEnd },
            },
            _sum: { amount: true },
        }),
        prisma.creatorWalletTransaction.aggregate({
            where: {
                wallet: { creatorId: creator.id },
                type: "GIFT_RECEIVED",
                createdAt: { gte: monthStart, lte: monthEnd },
            },
            _sum: { amount: true },
        }),
    ])

    const monthlyEarnings =
        Number(subscriptionEarnings._sum.amount ?? 0) +
        Number(giftEarnings._sum.amount ?? 0)

    // ── Pending payouts ───────────────────────────────────────────────────────
    const pendingPayouts = await prisma.withdrawal.aggregate({
        where: { creatorId: creator.id, status: "PENDING" },
        _sum: { netAmount: true },
    })

    // ── Wallet balance ────────────────────────────────────────────────────────
    const wallet = await prisma.creatorWallet.findUnique({
        where: { creatorId: creator.id },
        select: { balance: true },
    })

    // ── New followers this week ───────────────────────────────────────────────
    const newFollowersThisWeek = await prisma.follow.count({
        where: {
            creatorId: creator.id,
            createdAt: { gte: weekStart, lte: weekEnd },
        },
    })

    // ── New followers this month (for trend) ─────────────────────────────────
    const newFollowersThisMonth = await prisma.follow.count({
        where: {
            creatorId: creator.id,
            createdAt: { gte: monthStart, lte: monthEnd },
        },
    })

    // ── New subscribers this month ────────────────────────────────────────────
    const newSubscribersThisMonth = await prisma.subscription.count({
        where: {
            creatorId: creator.id,
            createdAt: { gte: monthStart, lte: monthEnd },
        },
    })

    // ── Recent activity ───────────────────────────────────────────────────────
    const [recentFollows, recentSubscriptions, recentGifts] = await Promise.all([
        prisma.follow.findMany({
            where: { creatorId: creator.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                createdAt: true,
                user: {
                    select: {
                        username: true,
                        firstName: true,
                        image: true,
                    },
                },
            },
        }),
        prisma.subscription.findMany({
            where: { creatorId: creator.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                amountPaid: true,
                createdAt: true,
                user: {
                    select: {
                        username: true,
                        firstName: true,
                        image: true,
                    },
                },
            },
        }),
        prisma.giftTransaction.findMany({
            where: { creatorId: creator.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                amount: true,
                quantity: true,
                createdAt: true,
                gift: { select: { name: true } },
                sender: {
                    select: {
                        username: true,
                        firstName: true,
                        image: true,
                    },
                },
            },
        }),
    ])

    // ── Upcoming streams ──────────────────────────────────────────────────────
    const upcomingStreams = await prisma.liveStream.findMany({
        where: {
            creatorId: creator.id,
            status: "SCHEDULED",
            startedAt: { gte: now },
        },
        orderBy: { startedAt: "asc" },
        take: 3,
        select: {
            id: true,
            title: true,
            startedAt: true,
        },
    })

    // ── Profile completion ────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            firstName: true,
            lastName: true,
            image: true,
            username: true,
        },
    })

    const completionFields = [
        !!user?.firstName,
        !!user?.lastName,
        !!user?.image,
        !!user?.username,
        !!creator.displayName,
        creator.isVerified,
    ]
    const profileCompletion = Math.round(
        (completionFields.filter(Boolean).length / completionFields.length) * 100
    )

    return {
        creator,
        stats: {
            followersCount: creator.followersCount,
            subscribersCount: creator.subscribersCount,
            monthlyEarnings,
            pendingPayouts: Number(pendingPayouts._sum.netAmount ?? 0),
            walletBalance: Number(wallet?.balance ?? 0),
            profileCompletion,
            newFollowersThisWeek,
            newFollowersThisMonth,
            newSubscribersThisMonth,
        },
        recentFollows,
        recentSubscriptions,
        recentGifts,
        upcomingStreams,
    }
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>