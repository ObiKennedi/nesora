// actions/creator/subscription-plans.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z } from "zod"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({
        where: { userId },
    })
    if (!creator) redirect("/onboarding")
    return creator
}

const PlanSchema = z.object({
    name: z.string().min(1, "Plan name is required").max(50),
    description: z.string().max(200).optional(),
    price: z.number().min(100, "Minimum price is ₦100"),
    interval: z.enum(["monthly", "yearly"]).default("monthly"),
    benefits: z.array(z.string().min(1)).min(1, "Add at least one benefit").max(10),
})

// ── Get all plans ─────────────────────────────────────────────────────────────

export async function getSubscriptionPlansAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const plans = await prisma.subscriptionPlan.findMany({
        where: { creatorId: creator.id },
        orderBy: { price: "asc" },
        include: {
            _count: {
                select: {
                    subscriptions: {
                        where: { status: "ACTIVE" },
                    },
                },
            },
        },
    })

    return plans
}

// ── Create plan ───────────────────────────────────────────────────────────────

export async function createSubscriptionPlanAction(
    data: z.infer<typeof PlanSchema>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = PlanSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)

    // Max 3 plans per creator
    const existingCount = await prisma.subscriptionPlan.count({
        where: { creatorId: creator.id },
    })
    if (existingCount >= 3) {
        return { error: "You can create a maximum of 3 subscription plans." }
    }

    // Enable subscriptions on creator if not already
    await prisma.creator.update({
        where: { id: creator.id },
        data: { subscriptionEnabled: true },
    })

    const plan = await prisma.subscriptionPlan.create({
        data: {
            creatorId: creator.id,
            name: parsed.data.name,
            description: parsed.data.description,
            price: parsed.data.price,
            interval: parsed.data.interval,
            benefits: parsed.data.benefits,
        },
    })

    return { success: true, planId: plan.id }
}

// ── Update plan ───────────────────────────────────────────────────────────────

export async function updateSubscriptionPlanAction(
    planId: string,
    data: Partial<z.infer<typeof PlanSchema>>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const plan = await prisma.subscriptionPlan.findFirst({
        where: { id: planId, creatorId: creator.id },
    })
    if (!plan) return { error: "Plan not found." }

    await prisma.subscriptionPlan.update({
        where: { id: planId },
        data: {
            name: data.name,
            description: data.description,
            price: data.price,
            interval: data.interval,
            benefits: data.benefits,
        },
    })

    return { success: true }
}

// ── Toggle plan active/inactive ───────────────────────────────────────────────

export async function togglePlanStatusAction(planId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const plan = await prisma.subscriptionPlan.findFirst({
        where: { id: planId, creatorId: creator.id },
    })
    if (!plan) return { error: "Plan not found." }

    await prisma.subscriptionPlan.update({
        where: { id: planId },
        data: { isActive: !plan.isActive },
    })

    return { success: true, isActive: !plan.isActive }
}

// ── Delete plan ───────────────────────────────────────────────────────────────

export async function deletePlanAction(planId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const plan = await prisma.subscriptionPlan.findFirst({
        where: { id: planId, creatorId: creator.id },
    })
    if (!plan) return { error: "Plan not found." }

    // Check for active subscribers on this plan
    const activeSubscribers = await prisma.subscription.count({
        where: { subscriptionPlanId: planId, status: "ACTIVE" },
    })
    if (activeSubscribers > 0) {
        return {
            error: `Cannot delete — ${activeSubscribers} active subscriber${activeSubscribers !== 1 ? "s" : ""} on this plan.`
        }
    }

    await prisma.subscriptionPlan.delete({ where: { id: planId } })

    return { success: true }
}