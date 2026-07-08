// actions/admin/withdrawals.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin"
import { createTransferRecipient, initiateTransfer, PaystackError } from "@/lib/paystack-transfers"
import { revalidatePath } from "next/cache"
import { createId } from "@paralleldrive/cuid2"
import { z } from "zod"

export async function getWithdrawalQueueAction(params?: {
    status?: "PENDING" | "PROCESSING" | "PAID" | "REJECTED" | "FAILED"
    page?:   number
    limit?:  number
}) {
    await requireAdmin()

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 20
    const skip  = (page - 1) * limit
    const where = { status: params?.status ?? ("PENDING" as const) }

    const [withdrawals, total, pendingAgg] = await Promise.all([
        prisma.withdrawal.findMany({
            where,
            orderBy: { createdAt: "asc" },
            skip,
            take: limit,
            include: {
                bankAccount: true,
                creator: {
                    select: {
                        id: true,
                        displayName: true,
                        handle: true,
                        isVerified: true,
                        trustScore: true,
                        user:   { select: { id: true, email: true, image: true } },
                        wallet: { select: { balance: true } },
                    },
                },
            },
        }),
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.aggregate({
            where: { status: "PENDING" },
            _sum:  { netAmount: true },
            _count: true,
        }),
    ])

    return {
        withdrawals,
        total,
        pages: Math.ceil(total / limit),
        page,
        queueStats: {
            pendingCount: pendingAgg._count,
            pendingTotal: Number(pendingAgg._sum.netAmount ?? 0),
        },
    }
}

export async function approveWithdrawalAction(withdrawalId: string) {
    const admin = await requireAdmin()

    const withdrawal = await prisma.withdrawal.findUnique({
        where:   { id: withdrawalId },
        include: {
            bankAccount: true,
            creator: { select: { id: true, displayName: true, userId: true } },
        },
    })

    if (!withdrawal)              return { error: "Withdrawal not found." }
    if (!withdrawal.bankAccount)  return { error: "No bank account attached to this withdrawal." }

    const reference = withdrawal.transferReference ?? `wd_${createId()}`

    const claimed = await prisma.withdrawal.updateMany({
        where: { id: withdrawalId, status: "PENDING" },
        data: {
            status:            "PROCESSING",
            reviewedById:      admin.id,
            reviewedAt:        new Date(),
            transferReference: reference,
        },
    })
    if (claimed.count === 0) {
        return { error: "This withdrawal is no longer pending — another admin may have handled it." }
    }

    try {
        let recipientCode = withdrawal.bankAccount.paystackRecipientCode
        if (!recipientCode) {
            recipientCode = await createTransferRecipient({
                accountName:   withdrawal.bankAccount.accountName,
                accountNumber: withdrawal.bankAccount.accountNumber,
                bankCode:      withdrawal.bankAccount.bankCode,
            })
            await prisma.bankAccount.update({
                where: { id: withdrawal.bankAccount.id },
                data:  { paystackRecipientCode: recipientCode },
            })
        }

        const { transferCode } = await initiateTransfer({
            amountNaira:   Number(withdrawal.netAmount),
            recipientCode,
            reference,
            reason: `NESORA payout · ${withdrawal.creator.displayName}`,
        })

        await prisma.$transaction(async (tx) => {
            await tx.withdrawal.update({
                where: { id: withdrawalId },
                data:  { paystackTransferCode: transferCode },
            })
            await logAdminAction({
                adminId:    admin.id,
                action:     "withdrawal.approve",
                targetType: "Withdrawal",
                targetId:   withdrawalId,
                metadata:   { reference, transferCode, netAmount: Number(withdrawal.netAmount) },
            }, tx)
        })

        revalidatePath("/admin/payouts")
        return { success: true as const, status: "PROCESSING" as const }

    } catch (err) {
        const message = err instanceof PaystackError ? err.message : "Transfer initiation failed."

        await prisma.withdrawal.updateMany({
            where: { id: withdrawalId, status: "PROCESSING" },
            data:  { status: "PENDING", failureReason: message },
        })

        return { error: `Paystack: ${message} — withdrawal returned to queue.` }
    }
}

const RejectSchema = z.object({
    withdrawalId: z.string().min(1),
    reason:       z.string().min(3, "Provide a rejection reason."),
})

export async function rejectWithdrawalAction(data: z.infer<typeof RejectSchema>) {
    const admin = await requireAdmin()

    const parsed = RejectSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { withdrawalId, reason } = parsed.data

    const withdrawal = await prisma.withdrawal.findUnique({
        where:   { id: withdrawalId },
        include: { creator: { select: { id: true, userId: true, wallet: { select: { id: true } } } } },
    })
    if (!withdrawal)                return { error: "Withdrawal not found." }
    if (!withdrawal.creator.wallet) return { error: "Creator wallet not found." }

    const gross    = Number(withdrawal.grossAmount)
    const walletId = withdrawal.creator.wallet.id

    try {
        await prisma.$transaction(async (tx) => {
            const claimed = await tx.withdrawal.updateMany({
                where: { id: withdrawalId, status: "PENDING" },
                data: {
                    status:       "REJECTED",
                    reviewedById: admin.id,
                    reviewedAt:   new Date(),
                    reviewNotes:  reason,
                },
            })
            if (claimed.count === 0) throw new Error("ALREADY_HANDLED")

            await tx.creatorWallet.update({
                where: { creatorId: withdrawal.creator.id },
                data:  { balance: { increment: gross } },
            })

            await tx.creatorWalletTransaction.create({
                data: {
                    walletId,
                    amount:      gross,
                    type:        "REFUND",
                    description: `Withdrawal rejected — funds returned. Reason: ${reason}`,
                },
            })

            await tx.notification.create({
                data: {
                    userId: withdrawal.creator.userId,
                    type:   "WITHDRAWAL_REJECTED",
                    title:  "Withdrawal rejected",
                    body:   `Your ₦${Number(withdrawal.netAmount).toLocaleString()} withdrawal was rejected: ${reason}. Funds have been returned to your wallet.`,
                    href:   "/creator/monetization/wallet",
                },
            })

            await logAdminAction({
                adminId:    admin.id,
                action:     "withdrawal.reject",
                targetType: "Withdrawal",
                targetId:   withdrawalId,
                metadata:   { reason, refunded: gross },
            }, tx)
        })
    } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_HANDLED") {
            return { error: "This withdrawal is no longer pending — another admin may have handled it." }
        }
        throw err
    }

    revalidatePath("/admin/payouts")
    return { success: true as const }
}