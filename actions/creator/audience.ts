// actions/creator/audience.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({
        where: { userId },
    })
    if (!creator) redirect("/onboarding")
    return creator
}

// ── Followers ─────────────────────────────────────────────────────────────────

export async function getFollowersAction(params?: {
    search?: string
    page?: number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page = params?.page ?? 1
    const limit = params?.limit ?? 20
    const skip = (page - 1) * limit

    const where = {
        creatorId: creator.id,
        ...(params?.search ? {
            user: {
                OR: [
                    { username: { contains: params.search, mode: "insensitive" as const } },
                    { firstName: { contains: params.search, mode: "insensitive" as const } },
                    { lastName: { contains: params.search, mode: "insensitive" as const } },
                ],
            },
        } : {}),
    }

    const [follows, total] = await Promise.all([
        prisma.follow.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        image: true,
                        // Check if this user is also a subscriber
                        subscriptions: {
                            where: { creatorId: creator.id, status: "ACTIVE" },
                            select: { id: true },
                            take: 1,
                        },
                        // Check if creator follows them back
                        follows: {
                            where: {
                                creator: { userId: { not: undefined } },
                            },
                            select: { id: true },
                            take: 1,
                        },
                    },
                },
            },
        }),
        prisma.follow.count({ where }),
    ])

    // Check which followers the creator follows back
    // by checking if creator's userId has a follow to each follower
    // who might also be a creator
    const followerUserIds = follows.map((f) => f.user.id)

    const followBacks = await prisma.follow.findMany({
        where: {
            userId: session.user.id,
            creator: { userId: { in: followerUserIds } },
        },
        select: { creator: { select: { userId: true } } },
    })

    const followBackSet = new Set(followBacks.map((f) => f.creator.userId))

    return {
        followers: follows.map((f) => ({
            ...f,
            isSubscriber: f.user.subscriptions.length > 0,
            creatorFollowsBack: followBackSet.has(f.user.id),
        })),
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

export async function followBackAction(targetUserId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // Find the creator profile of the target user (if they are a creator)
    const targetCreator = await prisma.creator.findUnique({
        where: { userId: targetUserId },
        select: { id: true },
    })

    if (!targetCreator) return { error: "This user is not a creator." }

    // Check if already following
    const existing = await prisma.follow.findFirst({
        where: {
            userId: session.user.id,
            creatorId: targetCreator.id,
        },
    })

    if (existing) return { error: "Already following." }

    await prisma.$transaction([
        prisma.follow.create({
            data: {
                userId: session.user.id,
                creatorId: targetCreator.id,
            },
        }),
        prisma.creator.update({
            where: { id: targetCreator.id },
            data: { followersCount: { increment: 1 } },
        }),
        prisma.notification.create({
            data: {
                userId: targetUserId,
                type: "NEW_FOLLOWER",
                title: "You have a new follower",
                body: "A creator you follow started following you back.",
                href: "/creator/audience/followers",
            },
        }),
    ])

    return { success: true }
}

// actions/creator/audience.ts — add these

// ── Subscribers ───────────────────────────────────────────────────────────────

export async function getSubscribersAction(params?: {
    search?: string
    status?: "ACTIVE" | "EXPIRED" | "CANCELLED" | "ALL"
    page?: number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page = params?.page ?? 1
    const limit = params?.limit ?? 20
    const skip = (page - 1) * limit
    const status = params?.status ?? "ALL"

    const where = {
        creatorId: creator.id,
        ...(status !== "ALL" ? { status } : {}),
        ...(params?.search ? {
            user: {
                OR: [
                    { username: { contains: params.search, mode: "insensitive" as const } },
                    { firstName: { contains: params.search, mode: "insensitive" as const } },
                    { lastName: { contains: params.search, mode: "insensitive" as const } },
                ],
            },
        } : {}),
    }

    const [subscriptions, total] = await Promise.all([
        prisma.subscription.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                status: true,
                amountPaid: true,
                startedAt: true,
                expiresAt: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                        image: true,
                    },
                },
            },
        }),
        prisma.subscription.count({ where }),
    ])

    // ── Revenue stats ─────────────────────────────────────────────────────────
    const [activeCount, totalRevenue, monthRevenue] = await Promise.all([
        prisma.subscription.count({
            where: { creatorId: creator.id, status: "ACTIVE" },
        }),
        prisma.subscription.aggregate({
            where: { creatorId: creator.id },
            _sum: { amountPaid: true },
        }),
        prisma.subscription.aggregate({
            where: {
                creatorId: creator.id,
                createdAt: { gte: new Date(new Date().setDate(1)) },
            },
            _sum: { amountPaid: true },
        }),
    ])

    return {
        subscriptions,
        total,
        pages: Math.ceil(total / limit),
        page,
        stats: {
            activeCount,
            totalRevenue: Number(totalRevenue._sum.amountPaid ?? 0),
            monthRevenue: Number(monthRevenue._sum.amountPaid ?? 0),
        },
    }
}

// actions/creator/audience.ts — add these

// ── Top Fans ──────────────────────────────────────────────────────────────────

export async function getTopFansAction(params?: {
    page?:  number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 20
    const skip  = (page - 1) * limit

    // ── Highest spenders (gift transactions) ──────────────────────────────────
    const spenders = await prisma.giftTransaction.groupBy({
        by:      ["senderId"],
        where:   { creatorId: creator.id },
        _sum:    { amount: true },
        _count:  { id: true },
        orderBy: { _sum: { amount: "desc" } },
        take:    100, // pull top 100 to merge with other signals
    })

    // ── Longest supporters (earliest follow date) ─────────────────────────────
    const longestFollowers = await prisma.follow.findMany({
        where:   { creatorId: creator.id },
        orderBy: { createdAt: "asc" },
        take:    100,
        select:  { userId: true, createdAt: true },
    })

    // ── Active subscribers ────────────────────────────────────────────────────
    const activeSubscribers = await prisma.subscription.findMany({
        where:   { creatorId: creator.id, status: "ACTIVE" },
        select:  { userId: true, startedAt: true, amountPaid: true },
    })

    // ── Merge all signals into a score ────────────────────────────────────────
    const scoreMap = new Map<string, {
        userId:          string
        giftTotal:       number
        giftCount:       number
        followedAt:      Date | null
        isSubscriber:    boolean
        subscriptionAge: number // days
        score:           number
    }>()

    // Gift spend — highest weight
    for (const s of spenders) {
        const existing = scoreMap.get(s.senderId) ?? {
            userId:          s.senderId,
            giftTotal:       0,
            giftCount:       0,
            followedAt:      null,
            isSubscriber:    false,
            subscriptionAge: 0,
            score:           0,
        }
        existing.giftTotal = Number(s._sum.amount ?? 0)
        existing.giftCount = s._count.id
        existing.score    += existing.giftTotal * 2 // 2x weight for spend
        scoreMap.set(s.senderId, existing)
    }

    // Longest follow — medium weight
    for (const f of longestFollowers) {
        const existing = scoreMap.get(f.userId) ?? {
            userId:          f.userId,
            giftTotal:       0,
            giftCount:       0,
            followedAt:      null,
            isSubscriber:    false,
            subscriptionAge: 0,
            score:           0,
        }
        const daysFollowing = Math.floor(
            (Date.now() - new Date(f.createdAt).getTime()) / 86_400_000
        )
        existing.followedAt = f.createdAt
        existing.score     += daysFollowing * 0.5 // 0.5 per day
        scoreMap.set(f.userId, existing)
    }

    // Active subscriber — bonus points
    for (const sub of activeSubscribers) {
        const existing = scoreMap.get(sub.userId) ?? {
            userId:          sub.userId,
            giftTotal:       0,
            giftCount:       0,
            followedAt:      null,
            isSubscriber:    false,
            subscriptionAge: 0,
            score:           0,
        }
        const daysSubscribed = Math.floor(
            (Date.now() - new Date(sub.startedAt).getTime()) / 86_400_000
        )
        existing.isSubscriber    = true
        existing.subscriptionAge = daysSubscribed
        existing.score          += Number(sub.amountPaid) + daysSubscribed * 1
        scoreMap.set(sub.userId, existing)
    }

    // Sort by score descending
    const sorted = Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)

    const totalTopFans = sorted.length
    const paginated    = sorted.slice(skip, skip + limit)

    // Fetch user details for the paginated set
    const userIds = paginated.map((f) => f.userId)

    const users = await prisma.user.findMany({
        where:  { id: { in: userIds } },
        select: {
            id:        true,
            username:  true,
            firstName: true,
            lastName:  true,
            image:     true,
        },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    const topFans = paginated
        .map((fan) => ({
            ...fan,
            user: userMap.get(fan.userId) ?? null,
        }))
        .filter((f) => f.user !== null)

    return {
        topFans,
        total: totalTopFans,
        pages: Math.ceil(totalTopFans / limit),
        page,
    }
}