"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Category } from "@prisma/client"

const SIGNAL_LIKE           = 1.0
const SIGNAL_COMMENT        = 2.0
const SIGNAL_LIKE_COMMENT   = 3.0
const SIGNAL_DECAY          = 0.95

async function updateInterestSignal(params: {
    userId:     string
    creatorId:  string
    categories: Category[]
    points:     number
}) {
    const { userId, creatorId, categories, points } = params

    await Promise.all(
        categories.map(async (category) => {
            const existing = await prisma.fanInterestSignal.findUnique({
                where: {
                    userId_creatorId_category: { userId, creatorId, category },
                },
            })

            const decayedScore = existing ? existing.score * SIGNAL_DECAY : 0

            await prisma.fanInterestSignal.upsert({
                where: {
                    userId_creatorId_category: { userId, creatorId, category },
                },
                update: { score: decayedScore + points },
                create: {
                    userId,
                    creatorId,
                    category,
                    score: points,
                },
            })
        })
    )
}

// ── Get creator categories for a post ────────────────────────────────────────

async function getPostCategories(postId: string): Promise<{
    creatorId:  string
    categories: Category[]
}> {
    const post = await prisma.post.findUnique({
        where:  { id: postId },
        select: {
            creatorId: true,
            creator: {
                select: {
                    creatorCategories: { select: { category: true } },
                },
            },
        },
    })

    return {
        creatorId:  post?.creatorId ?? "",
        categories: post?.creator.creatorCategories.map((c) => c.category) ?? [],
    }
}

// ── Like post ─────────────────────────────────────────────────────────────────

export async function likePostAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    const existing = await prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId } },
    })
    if (existing) return { success: true, liked: true } // idempotent

    await prisma.$transaction([
        prisma.postLike.create({ data: { postId, userId } }),
        prisma.post.update({
            where: { id: postId },
            data:  { likeCount: { increment: 1 } },
        }),
    ])

    // Check if fan has also commented — use combined signal if so
    const hasCommented = await prisma.postComment.findFirst({
        where: { postId, userId },
    })

    const { creatorId, categories } = await getPostCategories(postId)

    if (categories.length > 0 && creatorId) {
        await updateInterestSignal({
            userId,
            creatorId,
            categories,
            points: hasCommented ? SIGNAL_LIKE_COMMENT : SIGNAL_LIKE,
        })
    }

    return { success: true, liked: true }
}

// ── Unlike post ───────────────────────────────────────────────────────────────

export async function unlikePostAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    const existing = await prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId } },
    })
    if (!existing) return { success: true, liked: false }

    await prisma.$transaction([
        prisma.postLike.delete({
            where: { postId_userId: { postId, userId } },
        }),
        prisma.post.update({
            where: { id: postId },
            data:  { likeCount: { decrement: 1 } },
        }),
    ])

    // No signal decay on unlike — signals persist to avoid thrashing

    return { success: true, liked: false }
}

// ── Add comment ───────────────────────────────────────────────────────────────

export async function addCommentAction(params: {
    postId:    string
    body:      string
    parentId?: string
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const { postId, body, parentId } = params
    const userId = session.user.id

    if (!body.trim()) return { error: "Comment cannot be empty." }
    if (body.length > 1000) return { error: "Comment is too long." }

    const comment = await prisma.postComment.create({
        data: { postId, userId, body: body.trim(), parentId: parentId ?? null },
        include: {
            // Return user info so UI can display immediately
        },
    })

    await prisma.post.update({
        where: { id: postId },
        data:  { commentCount: { increment: 1 } },
    })

    // Signal update — check if fan has also liked
    const hasLiked = await prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId } },
    })

    const { creatorId, categories } = await getPostCategories(postId)

    if (categories.length > 0 && creatorId) {
        await updateInterestSignal({
            userId,
            creatorId,
            categories,
            // Combined reward if liked + commented, else comment-only
            points: hasLiked ? SIGNAL_LIKE_COMMENT : SIGNAL_COMMENT,
        })
    }

    // Notify post creator
    const post = await prisma.post.findUnique({
        where:  { id: postId },
        select: { creator: { select: { userId: true, displayName: true } } },
    })

    if (post && post.creator.userId !== userId) {
        await prisma.notification.create({
            data: {
                userId: post.creator.userId,
                type:   "SYSTEM",
                title:  "New comment on your post",
                body:   body.slice(0, 80),
                href:   `/creator/content/feed`,
            },
        })
    }

    return { success: true, comment }
}

// ── Get comments ──────────────────────────────────────────────────────────────

export async function getCommentsAction(params: {
    postId: string
    page?:  number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const { postId } = params
    const page  = params.page  ?? 1
    const limit = params.limit ?? 20
    const skip  = (page - 1) * limit

    // Top-level comments only (parentId = null)
    const [comments, total] = await Promise.all([
        prisma.postComment.findMany({
            where:   { postId, parentId: null },
            orderBy: { createdAt: "desc" },
            skip,
            take:    limit,
            include: {
                replies: {
                    orderBy: { createdAt: "asc" },
                    take:    5, // show first 5 replies, fan can load more
                    select: {
                        id:        true,
                        body:      true,
                        userId:    true,
                        createdAt: true,
                    },
                },
            },
        }),
        prisma.postComment.count({ where: { postId, parentId: null } }),
    ])

    // Collect all unique userIds across comments and replies
    const userIds = new Set<string>()
    for (const c of comments) {
        userIds.add(c.userId)
        for (const r of c.replies) userIds.add(r.userId)
    }

    const users = await prisma.user.findMany({
        where:  { id: { in: Array.from(userIds) } },
        select: {
            id:        true,
            username:  true,
            firstName: true,
            lastName:  true,
            image:     true,
        },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    const enriched = comments.map((c) => ({
        ...c,
        user:    userMap.get(c.userId) ?? null,
        replies: c.replies.map((r) => ({
            ...r,
            user: userMap.get(r.userId) ?? null,
        })),
    }))

    return { comments: enriched, total, pages: Math.ceil(total / limit), page }
}

// ── Save / unsave post ────────────────────────────────────────────────────────

export async function savePostAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    const existing = await prisma.postSave.findUnique({
        where: { postId_userId: { postId, userId } },
    })

    if (existing) {
        await prisma.postSave.delete({
            where: { postId_userId: { postId, userId } },
        })
        return { success: true, saved: false }
    }

    await prisma.postSave.create({ data: { postId, userId } })
    return { success: true, saved: true }
}

export async function recordShareAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) return

    try {
        await prisma.postShare.create({
            data: { postId, userId: session.user.id },
        })
    } catch {
        // Silently fail — share tracking is non-critical
    }
}

export async function purchasePostAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    // Check not already purchased
    const alreadyPurchased = await prisma.postPurchase.findUnique({
        where: { userId_postId: { userId, postId } },
    })
    if (alreadyPurchased) return { success: true } // idempotent

    // Get post + access info
    const post = await prisma.post.findUnique({
        where:   { id: postId },
        include: {
            access:  true,
            creator: {
                include: {
                    wallet:           true,
                    subscriptionPlans: {
                        where:   { isActive: true },
                        orderBy: { price: "asc" },
                    },
                },
            },
        },
    })

    if (!post) return { error: "Post not found." }

    const accessLevel    = post.access?.accessLevel    ?? "PUBLIC"
    const allowedPlanIds = post.access?.allowedPlanIds ?? []

    // Derive unlock price
    let unlockPrice: number | null = null

    if (accessLevel === "PLAN_SPECIFIC" && allowedPlanIds.length > 0) {
        const plans = await prisma.subscriptionPlan.findMany({
            where:   { id: { in: allowedPlanIds }, isActive: true },
            orderBy: { price: "asc" },
            select:  { price: true },
        })
        if (plans.length > 0) {
            unlockPrice = Math.round(Number(plans[0].price) * 0.1)
        }
    } else if (accessLevel === "SUBSCRIBERS_ONLY") {
        const cheapest = post.creator.subscriptionPlans[0]
        if (cheapest) {
            unlockPrice = Math.round(Number(cheapest.price) * 0.1)
        }
    }

    if (!unlockPrice || unlockPrice <= 0) {
        return { error: "This post cannot be purchased individually." }
    }

    // Check fan wallet balance
    const wallet = await prisma.userWallet.findUnique({
        where:  { userId },
        select: { id: true, balance: true },
    })

    if (!wallet) return { error: "Wallet not found. Please top up first.", code: "NO_WALLET" }

    const balance = Number(wallet.balance)
    if (balance < unlockPrice) {
        return {
            error:   "Insufficient wallet balance.",
            code:    "INSUFFICIENT_FUNDS",
            needed:  unlockPrice,
            balance,
            shortfall: unlockPrice - balance,
        }
    }

    // Ensure creator wallet exists
    const creatorWallet = post.creator.wallet
    if (!creatorWallet) return { error: "Creator wallet not found." }

    // Execute purchase in a transaction
    await prisma.$transaction([
        // Deduct from fan wallet
        prisma.userWallet.update({
            where: { userId },
            data:  { balance: { decrement: unlockPrice } },
        }),

        // Fan wallet transaction record
        prisma.userWalletTransaction.create({
            data: {
                walletId:    wallet.id,
                amount:      unlockPrice,
                type:        "GIFT_PURCHASE", // closest semantic type
                description: `Unlocked post: ${post.title ?? post.id}`,
            },
        }),

        // Credit creator wallet immediately
        prisma.creatorWallet.update({
            where: { creatorId: post.creatorId },
            data:  { balance: { increment: unlockPrice } },
        }),

        // Creator wallet transaction record
        prisma.creatorWalletTransaction.create({
            data: {
                walletId:    creatorWallet.id,
                amount:      unlockPrice,
                type:        "GIFT_RECEIVED", // closest semantic type
                description: `Post unlock purchase`,
            },
        }),

        // Create purchase record (grants access)
        prisma.postPurchase.create({
            data: { userId, postId, amount: unlockPrice },
        }),

        // Notify the creator
        prisma.notification.create({
            data: {
                userId: post.creator.userId,
                type:   "TIP_RECEIVED",
                title:  "Someone unlocked your post",
                body:   `A fan paid ₦${unlockPrice.toLocaleString()} to unlock "${post.title ?? "your post"}"`,
                href:   `/creator/content/feed`,
            },
        }),
    ])

    return { success: true }
}

// ── Vote on poll ──────────────────────────────────────────────────────────────

export async function votePollAction(pollOptionId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    // Check option exists and get pollId
    const option = await prisma.pollOption.findUnique({
        where:  { id: pollOptionId },
        select: { pollId: true },
    })
    if (!option) return { error: "Poll option not found." }

    // Check not already voted on this poll
    const existingVote = await prisma.pollVote.findFirst({
        where: {
            pollOptionId: { in: await prisma.pollOption
                .findMany({ where: { pollId: option.pollId }, select: { id: true } })
                .then((opts) => opts.map((o) => o.id))
            },
            userId,
        },
    })
    if (existingVote) return { error: "You have already voted on this poll." }

    await prisma.$transaction([
        prisma.pollVote.create({ data: { pollOptionId, userId } }),
        prisma.pollOption.update({
            where: { id: pollOptionId },
            data:  { voteCount: { increment: 1 } },
        }),
    ])

    return { success: true }
}