// actions/admin/kyc.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// ── Queue ─────────────────────────────────────────────────────────────────────

export async function getKycQueueAction(params?: {
    status?: "PENDING" | "APPROVED" | "REJECTED"
    page?:   number
    limit?:  number
}) {
    await requireAdmin()

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 20
    const skip  = (page - 1) * limit
    const where = { status: params?.status ?? ("PENDING" as const) }

    const [verifications, total, pendingCount] = await Promise.all([
        prisma.creatorVerification.findMany({
            where,
            orderBy: { createdAt: "asc" }, // FIFO
            skip,
            take: limit,
            include: {
                creator: {
                    select: {
                        id: true,
                        displayName: true,
                        handle: true,
                        createdAt: true,
                        followersCount: true,
                        subscribersCount: true,
                        creatorCategories: { select: { category: true } },
                        user: {
                            select: {
                                id: true,
                                email: true,
                                image: true,
                                firstName: true,
                                lastName: true,
                                country: true,
                                city: true,
                                createdAt: true,
                            },
                        },
                    },
                },
                reviewedBy: { select: { firstName: true, lastName: true } },
            },
        }),
        prisma.creatorVerification.count({ where }),
        prisma.creatorVerification.count({ where: { status: "PENDING" } }),
    ])

    return {
        verifications,
        total,
        pages: Math.ceil(total / limit),
        page,
        pendingCount,
    }
}

// ── Approve ───────────────────────────────────────────────────────────────────

export async function approveKycAction(verificationId: string) {
    const admin = await requireAdmin()

    const verification = await prisma.creatorVerification.findUnique({
        where:   { id: verificationId },
        include: { creator: { select: { id: true, userId: true, displayName: true } } },
    })
    if (!verification) return { error: "Verification not found." }

    try {
        await prisma.$transaction(async (tx) => {
            // Optimistic claim — only PENDING can be approved
            const claimed = await tx.creatorVerification.updateMany({
                where: { id: verificationId, status: "PENDING" },
                data: {
                    status:          "APPROVED",
                    rejectionReason: null,
                    reviewedById:    admin.id,
                    reviewedAt:      new Date(),
                },
            })
            if (claimed.count === 0) throw new Error("ALREADY_HANDLED")

            await tx.creator.update({
                where: { id: verification.creator.id },
                data: {
                    isVerified:         true,
                    verificationStatus: "APPROVED",
                },
            })

            await tx.notification.create({
                data: {
                    userId: verification.creator.userId,
                    type:   "VERIFICATION_UPDATE",
                    title:  "You're verified! 🎉",
                    body:   "Your identity verification has been approved. You can now withdraw your earnings.",
                    href:   "/creator/monetization/wallet",
                },
            })

            await logAdminAction({
                adminId:    admin.id,
                action:     "kyc.approve",
                targetType: "CreatorVerification",
                targetId:   verificationId,
                metadata:   { creatorId: verification.creator.id },
            }, tx)
        })
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_HANDLED") {
            return { error: "This verification is no longer pending — another admin may have handled it." }
        }
        throw err
    }

    revalidatePath("/admin/kyc")
    return { success: true as const }
}

// ── Reject ────────────────────────────────────────────────────────────────────

const RejectKycSchema = z.object({
    verificationId: z.string().min(1),
    reason:         z.string().min(10, "Give the creator a clear reason (min 10 characters)."),
})

export async function rejectKycAction(data: z.infer<typeof RejectKycSchema>) {
    const admin = await requireAdmin()

    const parsed = RejectKycSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { verificationId, reason } = parsed.data

    const verification = await prisma.creatorVerification.findUnique({
        where:   { id: verificationId },
        include: { creator: { select: { id: true, userId: true } } },
    })
    if (!verification) return { error: "Verification not found." }

    try {
        await prisma.$transaction(async (tx) => {
            const claimed = await tx.creatorVerification.updateMany({
                where: { id: verificationId, status: "PENDING" },
                data: {
                    status:          "REJECTED",
                    rejectionReason: reason,
                    reviewedById:    admin.id,
                    reviewedAt:      new Date(),
                },
            })
            if (claimed.count === 0) throw new Error("ALREADY_HANDLED")

            await tx.creator.update({
                where: { id: verification.creator.id },
                data: {
                    isVerified:         false,
                    verificationStatus: "REJECTED",
                },
            })

            await tx.notification.create({
                data: {
                    userId: verification.creator.userId,
                    type:   "VERIFICATION_UPDATE",
                    title:  "Verification not approved",
                    body:   `Your identity verification was not approved: ${reason}. You can update your documents and resubmit.`,
                    href:   "/creator/settings/verification",
                },
            })

            await logAdminAction({
                adminId:    admin.id,
                action:     "kyc.reject",
                targetType: "CreatorVerification",
                targetId:   verificationId,
                metadata:   { creatorId: verification.creator.id, reason },
            }, tx)
        })
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_HANDLED") {
            return { error: "This verification is no longer pending — another admin may have handled it." }
        }
        throw err
    }

    revalidatePath("/admin/kyc")
    return { success: true as const }
}