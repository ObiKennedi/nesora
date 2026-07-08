import { prisma } from "@/lib/prisma"
import { redis }  from "@/lib/redis"

const TOP_FAN_CACHE_TTL_SECONDS = 60 * 60
const TOP_FAN_POOL_SIZE         = 100

export const topFansCacheKey = (creatorId: string) => `topfans:${creatorId}`

export type ScoredFan = {
    userId:          string
    giftTotal:       number
    giftCount:       number
    followedAt:      Date | null
    isSubscriber:    boolean
    subscriptionAge: number // days
    score:           number
}

function emptyEntry(userId: string): ScoredFan {
    return {
        userId,
        giftTotal:       0,
        giftCount:       0,
        followedAt:      null,
        isSubscriber:    false,
        subscriptionAge: 0,
        score:           0,
    }
}

export async function computeTopFanScores(creatorId: string): Promise<ScoredFan[]> {
    const [spenders, longestFollowers, activeSubscribers] = await Promise.all([
        prisma.giftTransaction.groupBy({
            by:      ["senderId"],
            where:   { creatorId },
            _sum:    { amount: true },
            _count:  { id: true },
            orderBy: { _sum: { amount: "desc" } },
            take:    100,
        }),
        prisma.follow.findMany({
            where:   { creatorId },
            orderBy: { createdAt: "asc" },
            take:    100,
            select:  { userId: true, createdAt: true },
        }),
        prisma.subscription.findMany({
            where:  { creatorId, status: "ACTIVE" },
            select: { userId: true, startedAt: true, amountPaid: true },
        }),
    ])

    const scoreMap = new Map<string, ScoredFan>()

    for (const s of spenders) {
        const entry = scoreMap.get(s.senderId) ?? emptyEntry(s.senderId)
        entry.giftTotal = Number(s._sum.amount ?? 0)
        entry.giftCount = s._count.id
        entry.score    += entry.giftTotal * 2
        scoreMap.set(s.senderId, entry)
    }

    for (const f of longestFollowers) {
        const entry = scoreMap.get(f.userId) ?? emptyEntry(f.userId)
        const daysFollowing = Math.floor(
            (Date.now() - new Date(f.createdAt).getTime()) / 86_400_000,
        )
        entry.followedAt = f.createdAt
        entry.score     += daysFollowing * 0.5
        scoreMap.set(f.userId, entry)
    }

    for (const sub of activeSubscribers) {
        const entry = scoreMap.get(sub.userId) ?? emptyEntry(sub.userId)
        const daysSubscribed = Math.floor(
            (Date.now() - new Date(sub.startedAt).getTime()) / 86_400_000,
        )
        entry.isSubscriber    = true
        entry.subscriptionAge = daysSubscribed
        entry.score          += Number(sub.amountPaid) + daysSubscribed * 1
        scoreMap.set(sub.userId, entry)
    }

    return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score)
}

async function computeTopFanIdPool(creatorId: string): Promise<string[]> {
    const scores = await computeTopFanScores(creatorId)
    return scores.slice(0, TOP_FAN_POOL_SIZE).map((f) => f.userId)
}

export async function getTopFanIds(creatorId: string, limit: number): Promise<string[]> {
    if (limit <= 0) return []

    let pool: string[] | null = null

    try {
        pool = await redis.get<string[]>(topFansCacheKey(creatorId))
    } catch {}

    if (!pool) {
        pool = await computeTopFanIdPool(creatorId)
        try {
            await redis.set(topFansCacheKey(creatorId), pool, {
                ex: TOP_FAN_CACHE_TTL_SECONDS,
            })
        } catch {}
    }

    return pool.slice(0, Math.min(limit, TOP_FAN_POOL_SIZE))
}
export async function isTopFan(
    creatorId: string,
    userId:    string,
    limit:     number,
): Promise<boolean> {
    const ids = await getTopFanIds(creatorId, limit)
    return ids.includes(userId)
}

export async function invalidateTopFanCache(creatorId: string): Promise<void> {
    try {
        await redis.del(topFansCacheKey(creatorId))
    } catch {}
}