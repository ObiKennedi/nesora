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