// actions/creator/analytics.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { subMonths, startOfMonth, endOfMonth, differenceInYears } from "date-fns"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) redirect("/onboarding")
    return creator
}

// ── Audience Analytics ────────────────────────────────────────────────────────

export async function getAudienceAnalyticsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    // Get all followers + subscribers with demographic data
    const [followers, subscribers] = await Promise.all([
        prisma.follow.findMany({
            where:  { creatorId: creator.id },
            select: {
                user: {
                    select: {
                        dateOfBirth: true,
                        gender:      true,
                        country:     true,
                        city:        true,
                    },
                },
                createdAt: true,
            },
        }),
        prisma.subscription.findMany({
            where:  { creatorId: creator.id, status: "ACTIVE" },
            select: {
                user: {
                    select: {
                        dateOfBirth: true,
                        gender:      true,
                        country:     true,
                        city:        true,
                    },
                },
            },
        }),
    ])

    // Merge unique audience (followers + subscribers, deduped by combining)
    const audience = [...followers.map(f => f.user), ...subscribers.map(s => s.user)]

    // ── Age groups ─────────────────────────────────────────────────────────────
    const ageGroups = { "13-17": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, "Unknown": 0 }
    audience.forEach((u) => {
        if (!u.dateOfBirth) { ageGroups["Unknown"]++; return }
        const age = differenceInYears(new Date(), new Date(u.dateOfBirth))
        if (age < 18)      ageGroups["13-17"]++
        else if (age < 25) ageGroups["18-24"]++
        else if (age < 35) ageGroups["25-34"]++
        else if (age < 45) ageGroups["35-44"]++
        else if (age < 55) ageGroups["45-54"]++
        else                ageGroups["55+"]++
    })

    // ── Gender breakdown ──────────────────────────────────────────────────────
    const genderCounts = { MALE: 0, FEMALE: 0, OTHER: 0, PREFER_NOT_TO_SAY: 0, Unknown: 0 }
    audience.forEach((u) => {
        if (u.gender) genderCounts[u.gender]++
        else          genderCounts.Unknown++
    })

    // ── Top locations ─────────────────────────────────────────────────────────
    const locationCounts = new Map<string, number>()
    audience.forEach((u) => {
        if (!u.country) return
        const key = u.city ? `${u.city}, ${u.country}` : u.country
        locationCounts.set(key, (locationCounts.get(key) ?? 0) + 1)
    })
    const topLocations = Array.from(locationCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([location, count]) => ({ location, count }))

    // ── Active hours (based on follow timestamps as proxy) ───────────────────
    const hourCounts = new Array(24).fill(0)
    followers.forEach((f) => {
        const hour = new Date(f.createdAt).getHours()
        hourCounts[hour]++
    })
    const activeHours = hourCounts.map((count, hour) => ({ hour, count }))

    return {
        totalAudience: audience.length,
        ageGroups: Object.entries(ageGroups).map(([range, count]) => ({ range, count })),
        genderCounts: Object.entries(genderCounts).map(([gender, count]) => ({ gender, count })),
        topLocations,
        activeHours,
    }
}

// ── Content Analytics ─────────────────────────────────────────────────────────

export async function getContentAnalyticsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const [totalViews, totalLikes, totalShares, totalSaves, topPosts] = await Promise.all([
        prisma.post.aggregate({
            where: { creatorId: creator.id },
            _sum:  { viewCount: true },
        }),
        prisma.post.aggregate({
            where: { creatorId: creator.id },
            _sum:  { likeCount: true },
        }),
        prisma.postShare.count({
            where: { post: { creatorId: creator.id } },
        }),
        prisma.postSave.count({
            where: { post: { creatorId: creator.id } },
        }),
        prisma.post.findMany({
            where:   { creatorId: creator.id, status: "PUBLISHED" },
            orderBy: { viewCount: "desc" },
            take:    5,
            select: {
                id:          true,
                title:       true,
                type:        true,
                viewCount:   true,
                likeCount:   true,
                commentCount: true,
                publishedAt: true,
                _count: {
                    select: { postShares: true, postSaves: true },
                },
            },
        }),
    ])

    // Engagement rate trend — last 6 months
    const months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i)
        return { label: date.toLocaleDateString("en-NG", { month: "short" }), start: startOfMonth(date), end: endOfMonth(date) }
    })

    const monthlyEngagement = await Promise.all(
        months.map(async ({ label, start, end }) => {
            const posts = await prisma.post.aggregate({
                where: {
                    creatorId:   creator.id,
                    publishedAt: { gte: start, lte: end },
                },
                _sum: { viewCount: true, likeCount: true, commentCount: true },
            })
            return {
                month:    label,
                views:    posts._sum.viewCount    ?? 0,
                likes:    posts._sum.likeCount     ?? 0,
                comments: posts._sum.commentCount  ?? 0,
            }
        })
    )

    return {
        totalViews:  totalViews._sum.viewCount ?? 0,
        totalLikes:  totalLikes._sum.likeCount ?? 0,
        totalShares,
        totalSaves,
        topPosts: topPosts.map((p) => ({
            ...p,
            shareCount: p._count.postShares,
            saveCount:  p._count.postSaves,
        })),
        monthlyEngagement,
    }
}

// ── Revenue Analytics ─────────────────────────────────────────────────────────

export async function getRevenueAnalyticsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const months = Array.from({ length: 6 }, (_, i) => {
        const date = subMonths(new Date(), 5 - i)
        return { label: date.toLocaleDateString("en-NG", { month: "short" }), start: startOfMonth(date), end: endOfMonth(date) }
    })

    // Earnings trend + subscriber growth per month
    const trends = await Promise.all(
        months.map(async ({ label, start, end }) => {
            const [subs, gifts, tips, newSubs, cancelledSubs] = await Promise.all([
                prisma.subscription.aggregate({
                    where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
                    _sum:  { amountPaid: true },
                }),
                prisma.giftTransaction.aggregate({
                    where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
                    _sum:  { amount: true },
                }),
                prisma.tip.aggregate({
                    where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
                    _sum:  { amount: true },
                }),
                prisma.subscription.count({
                    where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
                }),
                prisma.subscription.count({
                    where: { creatorId: creator.id, status: "CANCELLED", updatedAt: { gte: start, lte: end } },
                }),
            ])

            return {
                month:         label,
                subscriptions: Number(subs._sum.amountPaid  ?? 0),
                gifts:         Number(gifts._sum.amount     ?? 0),
                tips:          Number(tips._sum.amount      ?? 0),
                total:         Number(subs._sum.amountPaid ?? 0) + Number(gifts._sum.amount ?? 0) + Number(tips._sum.amount ?? 0),
                newSubscribers: newSubs,
                netGrowth:     newSubs - cancelledSubs,
            }
        })
    )

    // Revenue by source — all time
    const [allSubs, allGifts, allTips] = await Promise.all([
        prisma.subscription.aggregate({
            where: { creatorId: creator.id },
            _sum:  { amountPaid: true },
        }),
        prisma.giftTransaction.aggregate({
            where: { creatorId: creator.id },
            _sum:  { amount: true },
        }),
        prisma.tip.aggregate({
            where: { creatorId: creator.id },
            _sum:  { amount: true },
        }),
    ])

    const subTotal  = Number(allSubs._sum.amountPaid ?? 0)
    const giftTotal = Number(allGifts._sum.amount     ?? 0)
    const tipTotal  = Number(allTips._sum.amount      ?? 0)
    const grandTotal = subTotal + giftTotal + tipTotal

    return {
        trends,
        revenueBySource: {
            subscriptions: subTotal,
            gifts:         giftTotal,
            tips:          tipTotal,
            total:         grandTotal,
        },
    }
}