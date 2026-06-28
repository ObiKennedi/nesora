"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"

// ── Get fan's active subscriptions + their latest posts ───────────────────────

export async function getFanSubscriptionsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    const subscriptions = await prisma.subscription.findMany({
        where:   { userId, status: "ACTIVE" },
        orderBy: { startedAt: "desc" },
        include: {
            creator: {
                select: {
                    id:              true,
                    displayName:     true,
                    handle:          true,
                    isVerified:      true,
                    followersCount:  true,
                    subscribersCount: true,
                    user:            { select: { image: true } },
                    posts: {
                        where:   { status: "PUBLISHED" },
                        orderBy: { publishedAt: "desc" },
                        take:    3,
                        select: {
                            id:           true,
                            type:         true,
                            title:        true,
                            body:         true,
                            thumbnailUrl: true,
                            mediaUrls:    true,
                            likeCount:    true,
                            commentCount: true,
                            publishedAt:  true,
                            videoDuration: true,
                            access:       { select: { accessLevel: true } },
                        },
                    },
                },
            },
            subscriptionPlan: {
                select: {
                    id:       true,
                    name:     true,
                    price:    true,
                    interval: true,
                    benefits: true,
                },
            },
        },
    })

    return subscriptions.map((sub) => ({
        id:        sub.id,
        status:    sub.status,
        startedAt: sub.startedAt,
        expiresAt: sub.expiresAt,
        amountPaid: Number(sub.amountPaid),
        plan: sub.subscriptionPlan
            ? {
                id:       sub.subscriptionPlan.id,
                name:     sub.subscriptionPlan.name,
                price:    Number(sub.subscriptionPlan.price),
                interval: sub.subscriptionPlan.interval,
                benefits: sub.subscriptionPlan.benefits,
            }
            : null,
        creator: {
            id:              sub.creator.id,
            displayName:     sub.creator.displayName,
            handle:          sub.creator.handle,
            isVerified:      sub.creator.isVerified,
            followersCount:  sub.creator.followersCount,
            subscribersCount: sub.creator.subscribersCount,
            image:           sub.creator.user.image,
            latestPosts:     sub.creator.posts.map((p) => ({
                id:            p.id,
                type:          p.type,
                title:         p.title,
                body:          p.body,
                thumbnailUrl:  p.thumbnailUrl,
                mediaUrls:     p.mediaUrls,
                likeCount:     p.likeCount,
                commentCount:  p.commentCount,
                publishedAt:   p.publishedAt,
                videoDuration: p.videoDuration,
                accessLevel:   p.access?.accessLevel ?? "PUBLIC",
            })),
        },
    }))
}

// ── Get creators the fan follows but hasn't subscribed to ─────────────────────

export async function getFollowedNotSubscribedAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    // Get all subscribed creator IDs
    const subscribed = await prisma.subscription.findMany({
        where:  { userId, status: "ACTIVE" },
        select: { creatorId: true },
    })
    const subscribedIds = new Set(subscribed.map((s) => s.creatorId))

    // Get followed creators not in that set
    const follows = await prisma.follow.findMany({
        where: { userId },
        include: {
            creator: {
                select: {
                    id:              true,
                    displayName:     true,
                    handle:          true,
                    isVerified:      true,
                    followersCount:  true,
                    subscribersCount: true,
                    bio:             true,
                    user:            { select: { image: true } },
                    subscriptionPlans: {
                        where:   { isActive: true },
                        orderBy: { price: "asc" },
                        select: {
                            id:       true,
                            name:     true,
                            price:    true,
                            interval: true,
                            benefits: true,
                        },
                        take: 3,
                    },
                    creatorCategories: {
                        select: { category: true },
                        take:   3,
                    },
                },
            },
        },
    })

    return follows
        .filter((f) => !subscribedIds.has(f.creatorId))
        .map((f) => ({
            id:              f.creator.id,
            displayName:     f.creator.displayName,
            handle:          f.creator.handle,
            isVerified:      f.creator.isVerified,
            followersCount:  f.creator.followersCount,
            subscribersCount: f.creator.subscribersCount,
            bio:             f.creator.bio,
            image:           f.creator.user.image,
            categories:      f.creator.creatorCategories.map((c) => c.category),
            plans:           f.creator.subscriptionPlans.map((p) => ({
                id:       p.id,
                name:     p.name,
                price:    Number(p.price),
                interval: p.interval,
                benefits: p.benefits,
            })),
        }))
}

// ── Subscribe to a creator ────────────────────────────────────────────────────

const SubscribeSchema = z.object({
    creatorId: z.string().min(1),
    planId:    z.string().min(1),
})

export async function subscribeToPlanAction(data: z.infer<typeof SubscribeSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = SubscribeSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { creatorId, planId } = parsed.data
    const userId = session.user.id

    // Check not already subscribed
    const existing = await prisma.subscription.findFirst({
        where: { userId, creatorId, status: "ACTIVE" },
    })
    if (existing) return { error: "Already subscribed to this creator." }

    // Get plan
    const plan = await prisma.subscriptionPlan.findFirst({
        where:   { id: planId, creatorId, isActive: true },
        include: { creator: { include: { wallet: true, user: { select: { id: true } } } } },
    })
    if (!plan) return { error: "Plan not found." }

    const price = Number(plan.price)

    // Check wallet balance
    const wallet = await prisma.userWallet.findUnique({
        where:  { userId },
        select: { id: true, balance: true },
    })

    if (!wallet || Number(wallet.balance) < price) {
        return {
            error:     "INSUFFICIENT_FUNDS",
            needed:    price,
            balance:   Number(wallet?.balance ?? 0),
            shortfall: price - Number(wallet?.balance ?? 0),
        }
    }

    // Creator wallet
    const creatorWallet = plan.creator.wallet ?? await prisma.creatorWallet.create({
        data: { creatorId, balance: 0 },
    })

    const now       = new Date()
    const expiresAt = new Date(now)
    plan.interval === "yearly"
        ? expiresAt.setFullYear(expiresAt.getFullYear() + 1)
        : expiresAt.setMonth(expiresAt.getMonth() + 1)

    await prisma.$transaction([
        // Deduct from fan wallet
        prisma.userWallet.update({
            where: { userId },
            data:  { balance: { decrement: price } },
        }),

        // Fan wallet transaction
        prisma.userWalletTransaction.create({
            data: {
                walletId:    wallet.id,
                amount:      price,
                type:        "SUBSCRIPTION_PAYMENT",
                description: `Subscribed to ${plan.creator.displayName} — ${plan.name}`,
            },
        }),

        // Credit creator
        prisma.creatorWallet.update({
            where: { creatorId },
            data:  { balance: { increment: price } },
        }),

        // Creator wallet transaction
        prisma.creatorWalletTransaction.create({
            data: {
                walletId:    creatorWallet.id,
                amount:      price,
                type:        "SUBSCRIPTION_RECEIVED",
                description: `New subscriber — ${plan.name} plan`,
            },
        }),

        // Create subscription
        prisma.subscription.create({
            data: {
                userId,
                creatorId,
                planId,
                subscriptionPlanId: planId,
                amountPaid:  price,
                startedAt:   now,
                expiresAt,
                status:      "ACTIVE",
            },
        }),

        // Increment creator subscriber count
        prisma.creator.update({
            where: { id: creatorId },
            data:  { subscribersCount: { increment: 1 } },
        }),

        // Notify creator
        prisma.notification.create({
            data: {
                userId: plan.creator.user.id,
                type:   "NEW_SUBSCRIBER",
                title:  "New subscriber!",
                body:   `Someone just subscribed to your ${plan.name} plan.`,
                href:   "/creator/audience/subscribers",
            },
        }),
    ])

    return { success: true }
}

// ── Cancel subscription ───────────────────────────────────────────────────────

export async function cancelSubscriptionAction(subscriptionId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const sub = await prisma.subscription.findFirst({
        where: { id: subscriptionId, userId: session.user.id, status: "ACTIVE" },
        include: { creator: { select: { id: true } } },
    })
    if (!sub) return { error: "Subscription not found." }

    await prisma.$transaction([
        prisma.subscription.update({
            where: { id: subscriptionId },
            data:  { status: "CANCELLED" },
        }),
        prisma.creator.update({
            where: { id: sub.creator.id },
            data:  { subscribersCount: { decrement: 1 } },
        }),
    ])

    return { success: true }
}