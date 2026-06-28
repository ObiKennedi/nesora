"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Category } from "@prisma/client"

// ── Types ─────────────────────────────────────────────────────────────────────

type DiscoverCreator = {
    id:             string
    displayName:    string
    handle:         string | null
    bio:            string | null
    image:          string | null
    bannerImage:    string | null
    isVerified:     boolean
    followersCount: number
    categories:     Category[]
    isFollowing:    boolean
    isSubscribed:   boolean
    relevanceScore: number
}

// ── Get discover creators ─────────────────────────────────────────────────────

export async function getDiscoverCreatorsAction(params?: {
    category?: Category | "ALL"
    search?:   string
    page?:     number
    limit?:    number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id
    const page   = params?.page  ?? 1
    const limit  = params?.limit ?? 30
    const skip   = (page - 1) * limit

    // ── Gather fan's interest categories ──────────────────────────────────────

    // 1. Categories picked at signup
    const signupInterests = await prisma.userCategoryInterest.findMany({
        where:  { userId },
        select: { category: true },
    })
    const signupCategories = signupInterests.map((i) => i.category)

    // 2. Interest signals from interactions (aggregated by category)
    const interestSignals = await prisma.fanInterestSignal.groupBy({
        by:      ["category"],
        where:   { userId },
        _sum:    { score: true },
        orderBy: { _sum: { score: "desc" } },
    })

    // Build weighted category map: signup categories get base weight,
    // interaction signals add on top
    const categoryScoreMap = new Map<Category, number>()

    for (const cat of signupCategories) {
        categoryScoreMap.set(cat, (categoryScoreMap.get(cat) ?? 0) + 5)
    }

    for (const signal of interestSignals) {
        const existing = categoryScoreMap.get(signal.category) ?? 0
        categoryScoreMap.set(signal.category, existing + (signal._sum.score ?? 0))
    }

    // All relevant categories sorted by score
    const rankedCategories = Array.from(categoryScoreMap.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat)

    // ── Determine which category to filter by ─────────────────────────────────
    const filterCategory = params?.category && params.category !== "ALL"
        ? params.category
        : null

    const targetCategories = filterCategory
        ? [filterCategory]
        : rankedCategories.length > 0
            ? rankedCategories
            : Object.values(Category) as Category[] // fallback: show all

    // ── Fetch creators matching target categories ─────────────────────────────

    const searchFilter = params?.search?.trim()
        ? {
            OR: [
                { displayName: { contains: params.search.trim(), mode: "insensitive" as const } },
                { handle:      { contains: params.search.trim(), mode: "insensitive" as const } },
            ],
        }
        : {}

    const creators = await prisma.creator.findMany({
        where: {
            creatorCategories: {
                some: { category: { in: targetCategories } },
            },
            // Exclude the fan's own creator profile if they have one
            userId: { not: userId },
            ...searchFilter,
        },
        select: {
            id:             true,
            displayName:    true,
            handle:         true,
            bio:            true,
            isVerified:     true,
            followersCount: true,
            bannerImage:    true,
            user:           { select: { image: true } },
            creatorCategories: { select: { category: true } },
        },
        take: limit * 2, // fetch extra to score and sort
    })

    // ── Get fan's follows and subscriptions for status badges ──────────────────
    const creatorIds = creators.map((c) => c.id)

    const [follows, subscriptions] = await Promise.all([
        prisma.follow.findMany({
            where:  { userId, creatorId: { in: creatorIds } },
            select: { creatorId: true },
        }),
        prisma.subscription.findMany({
            where:  { userId, creatorId: { in: creatorIds }, status: "ACTIVE" },
            select: { creatorId: true },
        }),
    ])

    const followingSet  = new Set(follows.map((f) => f.creatorId))
    const subscribedSet = new Set(subscriptions.map((s) => s.creatorId))

    // ── Per-creator interest signal scores ─────────────────────────────────────
    const creatorSignals = await prisma.fanInterestSignal.findMany({
        where:  { userId, creatorId: { in: creatorIds } },
        select: { creatorId: true, score: true },
    })

    const creatorSignalMap = new Map<string, number>()
    for (const s of creatorSignals) {
        creatorSignalMap.set(
            s.creatorId,
            (creatorSignalMap.get(s.creatorId) ?? 0) + s.score
        )
    }

    // ── Score and sort creators ────────────────────────────────────────────────
    const scored: DiscoverCreator[] = creators.map((c) => {
        const categories = c.creatorCategories.map((cc) => cc.category)
        const isFollowing  = followingSet.has(c.id)
        const isSubscribed = subscribedSet.has(c.id)

        // Relevance score calculation:
        // - Category match with fan's interests (weighted by category rank)
        let relevance = 0
        for (const cat of categories) {
            const catScore = categoryScoreMap.get(cat) ?? 0
            relevance += catScore
        }
        // - Direct interaction signal boost
        relevance += (creatorSignalMap.get(c.id) ?? 0) * 3
        // - Follower count as tiebreaker
        relevance += Math.log(c.followersCount + 1) * 0.5
        // - Verified creator boost
        if (c.isVerified) relevance += 2
        // - Already following gets a slight deprioritize (fan already knows them)
        if (isFollowing) relevance -= 10

        return {
            id:             c.id,
            displayName:    c.displayName,
            handle:         c.handle,
            bio:            c.bio,
            image:          c.user.image,
            bannerImage:    c.bannerImage,
            isVerified:     c.isVerified,
            followersCount: c.followersCount,
            categories,
            isFollowing,
            isSubscribed,
            relevanceScore: relevance,
        }
    })

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Paginate after scoring
    const paginated = scored.slice(skip, skip + limit)
    const total     = scored.length

    return {
        creators:   paginated,
        total,
        pages:      Math.ceil(total / limit),
        page,
        categories: rankedCategories,
    }
}

// ── Follow creator ────────────────────────────────────────────────────────────

export async function followCreatorAction(creatorId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const existing = await prisma.follow.findUnique({
        where: { userId_creatorId: { userId: session.user.id, creatorId } },
    })
    if (existing) return { success: true, following: true }

    await prisma.$transaction([
        prisma.follow.create({
            data: { userId: session.user.id, creatorId },
        }),
        prisma.creator.update({
            where: { id: creatorId },
            data:  { followersCount: { increment: 1 } },
        }),
    ])

    // Notify creator
    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: { userId: true },
    })
    if (creator) {
        await prisma.notification.create({
            data: {
                userId: creator.userId,
                type:   "NEW_FOLLOWER",
                title:  "New follower",
                body:   "Someone started following you!",
                href:   "/creator/audience/followers",
            },
        })
    }

    return { success: true, following: true }
}

// ── Unfollow creator ──────────────────────────────────────────────────────────

export async function unfollowCreatorAction(creatorId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const existing = await prisma.follow.findUnique({
        where: { userId_creatorId: { userId: session.user.id, creatorId } },
    })
    if (!existing) return { success: true, following: false }

    await prisma.$transaction([
        prisma.follow.delete({
            where: { userId_creatorId: { userId: session.user.id, creatorId } },
        }),
        prisma.creator.update({
            where: { id: creatorId },
            data:  { followersCount: { decrement: 1 } },
        }),
    ])

    return { success: true, following: false }
}
