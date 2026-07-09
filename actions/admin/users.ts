// actions/admin/users.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// ── List / search ─────────────────────────────────────────────────────────────

export async function getUsersAction(params?: {
    q?:      string
    filter?: "all" | "creators" | "fans" | "suspended"
    page?:   number
    limit?:  number
}) {
    await requireAdmin()

    const page   = params?.page  ?? 1
    const limit  = params?.limit ?? 25
    const skip   = (page - 1) * limit
    const q      = params?.q?.trim()
    const filter = params?.filter ?? "all"

    const where = {
        ...(q
            ? {
                  OR: [
                      { email:    { contains: q, mode: "insensitive" as const } },
                      { username: { contains: q, mode: "insensitive" as const } },
                      { firstName:{ contains: q, mode: "insensitive" as const } },
                      { lastName: { contains: q, mode: "insensitive" as const } },
                      { creator: { handle: { contains: q, mode: "insensitive" as const } } },
                  ],
              }
            : {}),
        ...(filter === "creators"  ? { creator: { isNot: null } } : {}),
        ...(filter === "fans"      ? { creator: { is: null }, role: "USER" as const } : {}),
        ...(filter === "suspended" ? { isSuspended: true } : {}),
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                image: true,
                role: true,
                onboardingType: true,
                isSuspended: true,
                createdAt: true,
                creator: {
                    select: { id: true, displayName: true, handle: true, isVerified: true },
                },
            },
        }),
        prisma.user.count({ where }),
    ])

    return { users, total, pages: Math.ceil(total / limit), page }
}

// ── Detail ────────────────────────────────────────────────────────────────────

export async function getUserDetailAction(userId: string) {
    await requireAdmin()

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            image: true,
            role: true,
            onboardingType: true,
            emailVerified: true,
            isSuspended: true,
            suspendedAt: true,
            suspensionReason: true,
            country: true,
            city: true,
            createdAt: true,
            wallet: {
                select: {
                    balance: true,
                    transactions: {
                        orderBy: { createdAt: "desc" },
                        take: 10,
                        select: { id: true, amount: true, type: true, description: true, createdAt: true },
                    },
                },
            },
            creator: {
                select: {
                    id: true,
                    displayName: true,
                    handle: true,
                    isVerified: true,
                    verificationStatus: true,
                    followersCount: true,
                    subscribersCount: true,
                    trustScore: true,
                    createdAt: true,
                    wallet: {
                        select: {
                            balance: true,
                            transactions: {
                                orderBy: { createdAt: "desc" },
                                take: 10,
                                select: { id: true, amount: true, type: true, description: true, createdAt: true },
                            },
                        },
                    },
                    _count: {
                        select: { posts: true, streams: true, withdrawals: true },
                    },
                },
            },
            _count: {
                select: { subscriptions: true, follows: true, giftsSent: true },
            },
        },
    })

    if (!user) return { error: "User not found." as const }
    return { user: JSON.parse(JSON.stringify(user)) }
}

// ── Suspend / unsuspend ───────────────────────────────────────────────────────

const SuspendSchema = z.object({
    userId: z.string().min(1),
    reason: z.string().min(5, "Provide a suspension reason (min 5 characters)."),
})

export async function suspendUserAction(data: z.infer<typeof SuspendSchema>) {
    const admin = await requireAdmin()

    const parsed = SuspendSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { userId, reason } = parsed.data

    if (userId === admin.id) return { error: "You cannot suspend yourself." }

    const target = await prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true, role: true, isSuspended: true },
    })
    if (!target)              return { error: "User not found." }
    if (target.role === "ADMIN") return { error: "Admins cannot be suspended from this panel." }
    if (target.isSuspended)   return { error: "User is already suspended." }

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: {
                isSuspended:      true,
                suspendedAt:      new Date(),
                suspensionReason: reason,
            },
        })

        await tx.notification.create({
            data: {
                userId,
                type:  "SYSTEM",
                title: "Account suspended",
                body:  `Your account has been suspended: ${reason}`,
            },
        })

        await logAdminAction({
            adminId:    admin.id,
            action:     "user.suspend",
            targetType: "User",
            targetId:   userId,
            metadata:   { reason },
        }, tx)
    })

    revalidatePath("/admin/users")
    return { success: true as const }
}

export async function unsuspendUserAction(userId: string) {
    const admin = await requireAdmin()

    const target = await prisma.user.findUnique({
        where:  { id: userId },
        select: { id: true, isSuspended: true, suspensionReason: true },
    })
    if (!target)             return { error: "User not found." }
    if (!target.isSuspended) return { error: "User is not suspended." }

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: {
                isSuspended:      false,
                suspendedAt:      null,
                suspensionReason: null,
            },
        })

        await tx.notification.create({
            data: {
                userId,
                type:  "SYSTEM",
                title: "Account reinstated",
                body:  "Your account suspension has been lifted. Welcome back.",
            },
        })

        await logAdminAction({
            adminId:    admin.id,
            action:     "user.unsuspend",
            targetType: "User",
            targetId:   userId,
            metadata:   { previousReason: target.suspensionReason },
        }, tx)
    })

    revalidatePath("/admin/users")
    return { success: true as const }
}