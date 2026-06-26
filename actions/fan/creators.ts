"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"

// ── Get suggested creators ────────────────────────────────────────────────────
// Reads fan's UserCategoryInterest, finds creators with matching CreatorCategory,
// ranks by followersCount + subscribersCount descending, returns top 20 per category

export async function getSuggestedCreatorsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // Get fan's selected categories
    const interests = await prisma.userCategoryInterest.findMany({
        where:  { userId: session.user.id },
        select: { category: true },
    })

    if (interests.length === 0) return { creators: [], categories: [] }

    const categories = interests.map((i) => i.category)

    // Find creators in those categories, ranked by popularity
    const creatorCategories = await prisma.creatorCategory.findMany({
        where: {
            category: { in: categories },
        },
        select: {
            category: true,
            creator: {
                select: {
                    id:              true,
                    displayName:     true,
                    handle:          true,
                    bio:             true,
                    isVerified:      true,
                    followersCount:  true,
                    subscribersCount: true,
                    creatorCategories: {
                        select: { category: true },
                        take:   3,
                    },
                    user: {
                        select: { image: true },
                    },
                },
            },
        },
    })

    // Deduplicate creators (they may appear in multiple matching categories)
    const seen    = new Set<string>()
    const unique  = creatorCategories
        .map((cc) => ({ ...cc.creator, matchedCategory: cc.category }))
        .filter((c) => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
        })

    // Check which ones the fan already follows
    const alreadyFollowing = await prisma.follow.findMany({
        where: {
            userId:    session.user.id,
            creatorId: { in: unique.map((c) => c.id) },
        },
        select: { creatorId: true },
    })
    const followingSet = new Set(alreadyFollowing.map((f) => f.creatorId))

    // Rank by followersCount + subscribersCount
    const ranked = unique
        .sort((a, b) =>
            (b.followersCount + b.subscribersCount) -
            (a.followersCount + a.subscribersCount)
        )
        .slice(0, 20)
        .map((c) => ({
            id:              c.id,
            displayName:     c.displayName,
            handle:          c.handle,
            bio:             c.bio,
            image:           c.user.image,
            isVerified:      c.isVerified,
            followersCount:  c.followersCount,
            subscribersCount: c.subscribersCount,
            categories:      c.creatorCategories.map((cc) => cc.category),
            isFollowing:     followingSet.has(c.id),
        }))

    return { creators: ranked, categories }
}

// ── Follow a single creator ───────────────────────────────────────────────────

export async function followCreatorOnboardingAction(creatorId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // Check not already following
    const existing = await prisma.follow.findUnique({
        where: {
            userId_creatorId: {
                userId:    session.user.id,
                creatorId,
            },
        },
    })
    if (existing) return { success: true as const } // idempotent

    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: { userId: true },
    })
    if (!creator) return { success: false as const, error: "Creator not found." }

    await prisma.$transaction([
        prisma.follow.create({
            data: { userId: session.user.id, creatorId },
        }),
        prisma.creator.update({
            where: { id: creatorId },
            data:  { followersCount: { increment: 1 } },
        }),
        prisma.notification.create({
            data: {
                userId: creator.userId,
                type:   "NEW_FOLLOWER",
                title:  "You have a new follower",
                body:   "Someone just followed you on NESORA.",
                href:   "/creator/audience",
            },
        }),
    ])

    return { success: true as const }
}

// ── Unfollow a creator ────────────────────────────────────────────────────────

export async function unfollowCreatorOnboardingAction(creatorId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const existing = await prisma.follow.findUnique({
        where: {
            userId_creatorId: {
                userId:    session.user.id,
                creatorId,
            },
        },
    })
    if (!existing) return { success: true as const } // idempotent

    await prisma.$transaction([
        prisma.follow.delete({
            where: {
                userId_creatorId: {
                    userId:    session.user.id,
                    creatorId,
                },
            },
        }),
        prisma.creator.update({
            where: { id: creatorId },
            data:  { followersCount: { decrement: 1 } },
        }),
    ])

    return { success: true as const }
}

// ── Bulk follow (Follow All button) ──────────────────────────────────────────

export async function bulkFollowCreatorsAction(creatorIds: string[]) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    if (creatorIds.length === 0) return { success: true }

    // Filter out already-followed creators
    const existing = await prisma.follow.findMany({
        where: {
            userId:    session.user.id,
            creatorId: { in: creatorIds },
        },
        select: { creatorId: true },
    })
    const alreadyFollowedSet = new Set(existing.map((f) => f.creatorId))
    const toFollow = creatorIds.filter((id) => !alreadyFollowedSet.has(id))

    if (toFollow.length === 0) return { success: true }

    // Get creator userIds for notifications
    const creators = await prisma.creator.findMany({
        where:  { id: { in: toFollow } },
        select: { id: true, userId: true },
    })

    await prisma.$transaction([
        // Create all follows
        prisma.follow.createMany({
            data:           toFollow.map((creatorId) => ({
                userId: session.user.id,
                creatorId,
            })),
            skipDuplicates: true,
        }),

        // Increment follower counts
        prisma.creator.updateMany({
            where: { id: { in: toFollow } },
            data:  { followersCount: { increment: 1 } },
        }),

        // Notify each creator
        prisma.notification.createMany({
            data: creators.map((c) => ({
                userId: c.userId,
                type:   "NEW_FOLLOWER" as const,
                title:  "You have a new follower",
                body:   "Someone just followed you on NESORA.",
                href:   "/creator/audience",
            })),
        }),
    ])

    return { success: true, followedCount: toFollow.length }
}