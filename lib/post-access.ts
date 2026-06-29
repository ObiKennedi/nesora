import { prisma } from "@/lib/prisma"
import type { PostAccessLevel } from "@prisma/client"

// ── Resolve whether a user can view a post ────────────────────────────────────

export async function resolvePostAccess(params: {
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

// ── Derive one-time unlock price for a locked post ────────────────────────────
// PLAN_SPECIFIC  -> 10 % of the cheapest required plan price
// SUBSCRIBERS_ONLY -> 10 % of cheapest active plan
// Others -> null (no purchase option)

export async function resolveUnlockPrice(params: {
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
