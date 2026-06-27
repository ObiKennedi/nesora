"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Category, PostAccessLevel } from "@prisma/client"

// ── Constants ─────────────────────────────────────────────────────────────────

const FEED_LIMIT        = 20
const SHORTS_LIMIT      = 15
const SHORTS_MAX_SECS   = 120      // 2 minutes
const RANKED_RATIO      = 0.7      // 70% interest-ranked
const FRESH_RATIO       = 0.3      // 30% chronological

// ── Helpers ───────────────────────────────────────────────────────────────────

// Smooth recency decay: score → 1.0 at 0h, →0.1 at 7d+
function recencyScore(publishedAt: Date): number {
    const hoursOld = (Date.now() - publishedAt.getTime()) / 3_600_000
    return 1 / (1 + hoursOld * 0.02)
}

// Check whether the fan has the required access level for a post
async function resolvePostAccess(params: {
    userId:         string
    creatorId:      string
    accessLevel:    PostAccessLevel
    allowedPlanIds: string[]
}): Promise<{ hasAccess: boolean; lockReason: string | null }> {
    const { userId, creatorId, accessLevel, allowedPlanIds } = params

    switch (accessLevel) {
        case "PUBLIC":
            return { hasAccess: true, lockReason: null }

        case "FOLLOWERS_ONLY": {
            const follow = await prisma.follow.findUnique({
                where: { userId_creatorId: { userId, creatorId } },
            })
            return follow
                ? { hasAccess: true,  lockReason: null }
                : { hasAccess: false, lockReason: "FOLLOWERS_ONLY" }
        }

        case "SUBSCRIBERS_ONLY": {
            const sub = await prisma.subscription.findFirst({
                where: { userId, creatorId, status: "ACTIVE" },
            })
            return sub
                ? { hasAccess: true,  lockReason: null }
                : { hasAccess: false, lockReason: "SUBSCRIBERS_ONLY" }
        }

        case "PLAN_SPECIFIC": {
            if (allowedPlanIds.length === 0)
                return { hasAccess: false, lockReason: "PLAN_SPECIFIC" }

            const sub = await prisma.subscription.findFirst({
                where: {
                    userId,
                    creatorId,
                    status:            "ACTIVE",
                    subscriptionPlanId: { in: allowedPlanIds },
                },
            })
            return sub
                ? { hasAccess: true,  lockReason: null }
                : { hasAccess: false, lockReason: "PLAN_SPECIFIC" }
        }

        case "TOP_FANS_ONLY": {
            const topFans = await prisma.giftTransaction.groupBy({
                by:      ["senderId"],
                where:   { creatorId },
                _sum:    { amount: true },
                orderBy: { _sum: { amount: "desc" } },
                take:    50,
            })
            const isTopFan = topFans.some((f) => f.senderId === userId)
            return isTopFan
                ? { hasAccess: true,  lockReason: null }
                : { hasAccess: false, lockReason: "TOP_FANS_ONLY" }
        }

        default:
            return { hasAccess: false, lockReason: "UNKNOWN" }
    }
}

// Derive one-time unlock price for a locked post:
// PLAN_SPECIFIC → 10% of the required plan price
// SUBSCRIBERS_ONLY → 10% of cheapest active plan
// Others → null (no purchase option)
async function resolveUnlockPrice(params: {
    creatorId:      string
    accessLevel:    PostAccessLevel
    allowedPlanIds: string[]
}): Promise<number | null> {
    const { creatorId, accessLevel, allowedPlanIds } = params

    if (accessLevel === "PLAN_SPECIFIC" && allowedPlanIds.length > 0) {
        const plans = await prisma.subscriptionPlan.findMany({
            where:   { id: { in: allowedPlanIds }, isActive: true },
            orderBy: { price: "asc" },
            select:  { price: true },
        })
        if (plans.length === 0) return null
        return Math.round(Number(plans[0].price) * 0.1)
    }

    if (accessLevel === "SUBSCRIBERS_ONLY") {
        const cheapest = await prisma.subscriptionPlan.findFirst({
            where:   { creatorId, isActive: true },
            orderBy: { price: "asc" },
            select:  { price: true },
        })
        if (!cheapest) return null
        return Math.round(Number(cheapest.price) * 0.1)
    }

    return null
}

// ── Get fan's followed + subscribed creator IDs ───────────────────────────────

async function getFanCreatorIds(userId: string): Promise<string[]> {
    const [follows, subscriptions] = await Promise.all([
        prisma.follow.findMany({
            where:  { userId },
            select: { creatorId: true },
        }),
        prisma.subscription.findMany({
            where:  { userId, status: "ACTIVE" },
            select: { creatorId: true },
        }),
    ])

    const ids = new Set<string>([
        ...follows.map((f) => f.creatorId),
        ...subscriptions.map((s) => s.creatorId),
    ])

    return Array.from(ids)
}

// ── Main feed action ──────────────────────────────────────────────────────────

export async function getFeedAction(params?: {
    category?: Category | "ALL"
    page?:     number
    limit?:    number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId   = session.user.id
    const page     = params?.page  ?? 1
    const limit    = params?.limit ?? FEED_LIMIT
    const skip     = (page - 1) * limit
    const category = params?.category ?? "ALL"

    // ── 1. Get creator IDs the fan follows or subscribes to ───────────────────
    const creatorIds = await getFanCreatorIds(userId)

    if (creatorIds.length === 0) {
        return { posts: [], total: 0, pages: 0, page }
    }

    // ── 2. Get fan's interest signals (for ranking) ───────────────────────────
    const signals = await prisma.fanInterestSignal.findMany({
        where:  { userId },
        select: { creatorId: true, category: true, score: true },
    })

    // Build a fast lookup: "creatorId:category" → score
    const signalMap = new Map<string, number>()
    for (const s of signals) {
        signalMap.set(`${s.creatorId}:${s.category}`, s.score)
    }

    // ── 3. Fetch published posts from followed/subscribed creators ────────────
    const categoryFilter = category === "ALL"
        ? {}
        : {
            creator: {
                creatorCategories: {
                    some: { category },
                },
            },
        }

    const rawPosts = await prisma.post.findMany({
        where: {
            creatorId: { in: creatorIds },
            status:    "PUBLISHED",
            ...categoryFilter,
        },
        include: {
            creator: {
                select: {
                    id:          true,
                    displayName: true,
                    handle:      true,
                    isVerified:  true,
                    creatorCategories: { select: { category: true } },
                    user:        { select: { image: true } },
                },
            },
            access:    true,
            poll:      { include: { options: true } },
            likes:     { where: { userId }, select: { id: true } },
            postSaves: { where: { userId }, select: { id: true } },
            postPurchases: { where: { userId }, select: { id: true } },
            _count: {
                select: {
                    likes:    true,
                    comments: true,
                },
            },
        },
        orderBy: { publishedAt: "desc" },
        take:    limit * 5, // fetch a wider pool to rank from
    })

    // ── 4. Score each post ────────────────────────────────────────────────────
    const scoredPosts = rawPosts.map((post) => {
        const categories = post.creator.creatorCategories.map((cc) => cc.category)

        // Sum interest signals across all creator categories
        const interestScore = categories.reduce((sum, cat) => {
            return sum + (signalMap.get(`${post.creatorId}:${cat}`) ?? 0)
        }, 0)

        const recency = recencyScore(post.publishedAt ?? post.createdAt)

        // 70/30 weighted final score
        const finalScore =
            RANKED_RATIO * interestScore + FRESH_RATIO * recency

        return { post, finalScore, recency }
    })

    // ── 5. Split into ranked and fresh pools, then merge ─────────────────────
    const ranked = [...scoredPosts]
        .sort((a, b) => b.finalScore - a.finalScore)

    const fresh = [...scoredPosts]
        .sort((a, b) => b.recency - a.recency)

    // Merge: take from ranked and fresh alternately in 7:3 ratio
    const seen    = new Set<string>()
    const merged: typeof scoredPosts = []

    let ri = 0, fi = 0
    while (merged.length < limit * 3 && (ri < ranked.length || fi < fresh.length)) {
        // Add ~7 ranked then ~3 fresh
        for (let i = 0; i < 7 && ri < ranked.length; i++) {
            const item = ranked[ri++]
            if (!seen.has(item.post.id)) {
                seen.add(item.post.id)
                merged.push(item)
            }
        }
        for (let i = 0; i < 3 && fi < fresh.length; i++) {
            const item = fresh[fi++]
            if (!seen.has(item.post.id)) {
                seen.add(item.post.id)
                merged.push(item)
            }
        }
    }

    // ── 6. Paginate ───────────────────────────────────────────────────────────
    const paginated = merged.slice(skip, skip + limit)
    const total     = merged.length

    // ── 7. Resolve access for each post ───────────────────────────────────────
    const postsWithAccess = await Promise.all(
        paginated.map(async ({ post }) => {
            const accessLevel    = post.access?.accessLevel    ?? "PUBLIC"
            const allowedPlanIds = post.access?.allowedPlanIds ?? []

            // Check if already purchased
            const alreadyPurchased = post.postPurchases.length > 0

            const { hasAccess, lockReason } = alreadyPurchased
                ? { hasAccess: true, lockReason: null }
                : await resolvePostAccess({
                    userId,
                    creatorId:   post.creatorId,
                    accessLevel,
                    allowedPlanIds,
                })

            const unlockPrice = (!hasAccess && lockReason)
                ? await resolveUnlockPrice({
                    creatorId: post.creatorId,
                    accessLevel,
                    allowedPlanIds,
                })
                : null

            return {
                id:           post.id,
                type:         post.type,
                status:       post.status,
                title:        post.title,
                body:         hasAccess ? post.body         : null,
                mediaUrls:    hasAccess ? post.mediaUrls    : [],
                thumbnailUrl: post.thumbnailUrl, // always show thumbnail (blurred via CSS)
                videoDuration: post.videoDuration,
                publishedAt:  post.publishedAt,
                createdAt:    post.createdAt,
                viewCount:    post.viewCount,
                likeCount:    post._count.likes,
                commentCount: post._count.comments,

                // Fan's own interaction state
                isLiked:     post.likes.length > 0,
                isSaved:     post.postSaves.length > 0,
                isPurchased: alreadyPurchased,

                // Access
                hasAccess,
                lockReason,
                unlockPrice,

                // Poll (only if accessible)
                poll: hasAccess ? post.poll : null,

                // Creator
                creator: {
                    id:          post.creator.id,
                    displayName: post.creator.displayName,
                    handle:      post.creator.handle,
                    isVerified:  post.creator.isVerified,
                    image:       post.creator.user.image,
                    categories:  post.creator.creatorCategories.map((c) => c.category),
                },
            }
        })
    )

    return {
        posts: postsWithAccess,
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

// ── Shorts feed ───────────────────────────────────────────────────────────────
// Videos with videoDuration <= 120 seconds from followed/subscribed creators

export async function getShortsAction(params?: {
    page?:  number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id
    const page   = params?.page  ?? 1
    const limit  = params?.limit ?? SHORTS_LIMIT
    const skip   = (page - 1) * limit

    const creatorIds = await getFanCreatorIds(userId)
    if (creatorIds.length === 0) return { shorts: [], total: 0, pages: 0, page }

    const [shorts, total] = await Promise.all([
        prisma.post.findMany({
            where: {
                creatorId:     { in: creatorIds },
                status:        "PUBLISHED",
                type:          "VIDEO",
                videoDuration: { lte: SHORTS_MAX_SECS, not: null },
            },
            orderBy: { publishedAt: "desc" },
            skip,
            take: limit,
            include: {
                creator: {
                    select: {
                        id:          true,
                        displayName: true,
                        handle:      true,
                        isVerified:  true,
                        user:        { select: { image: true } },
                    },
                },
                access:    true,
                likes:     { where: { userId }, select: { id: true } },
                postSaves: { where: { userId }, select: { id: true } },
                postPurchases: { where: { userId }, select: { id: true } },
                _count: { select: { likes: true, comments: true } },
            },
        }),
        prisma.post.count({
            where: {
                creatorId:     { in: creatorIds },
                status:        "PUBLISHED",
                type:          "VIDEO",
                videoDuration: { lte: SHORTS_MAX_SECS, not: null },
            },
        }),
    ])

    // Resolve access for each short
    const shortsWithAccess = await Promise.all(
        shorts.map(async (post) => {
            const accessLevel    = post.access?.accessLevel    ?? "PUBLIC"
            const allowedPlanIds = post.access?.allowedPlanIds ?? []
            const alreadyPurchased = post.postPurchases.length > 0

            const { hasAccess, lockReason } = alreadyPurchased
                ? { hasAccess: true, lockReason: null }
                : await resolvePostAccess({
                    userId,
                    creatorId: post.creatorId,
                    accessLevel,
                    allowedPlanIds,
                })

            const unlockPrice = (!hasAccess && lockReason)
                ? await resolveUnlockPrice({
                    creatorId: post.creatorId,
                    accessLevel,
                    allowedPlanIds,
                })
                : null

            return {
                id:            post.id,
                type:          post.type,
                title:         post.title,
                body:          hasAccess ? post.body : null,
                mediaUrls:     hasAccess ? post.mediaUrls : [],
                thumbnailUrl:  post.thumbnailUrl,
                videoDuration: post.videoDuration,
                publishedAt:   post.publishedAt,
                likeCount:     post._count.likes,
                commentCount:  post._count.comments,
                isLiked:       post.likes.length > 0,
                isSaved:       post.postSaves.length > 0,
                isPurchased:   alreadyPurchased,
                hasAccess,
                lockReason,
                unlockPrice,
                creator: {
                    id:          post.creator.id,
                    displayName: post.creator.displayName,
                    handle:      post.creator.handle,
                    isVerified:  post.creator.isVerified,
                    image:       post.creator.user.image,
                },
            }
        })
    )

    return { shorts: shortsWithAccess, total, pages: Math.ceil(total / limit), page }
}

// ── Record post view ──────────────────────────────────────────────────────────
// Fire-and-forget — increments viewCount + creates PostView record

export async function recordPostViewAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) return

    try {
        await prisma.$transaction([
            prisma.postView.create({
                data: { postId, userId: session.user.id },
            }),
            prisma.post.update({
                where: { id: postId },
                data:  { viewCount: { increment: 1 } },
            }),
        ])
    } catch (err) {
        // View tracking is non-critical, but log for observability
        console.error("[recordPostView] Failed to record view:", err)
    }
}