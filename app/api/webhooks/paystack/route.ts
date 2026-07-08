// app/api/webhooks/paystack/route.ts
import { NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
    const rawBody = await req.text()

    const signature = req.headers.get("x-paystack-signature")
    const expected  = crypto
        .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
        .update(rawBody)
        .digest("hex")

    if (!signature || signature !== expected) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const event = JSON.parse(rawBody) as {
        event: string
        data: { reference?: string; transfer_code?: string; reason?: string; failures?: unknown }
    }

    switch (event.event) {
        case "transfer.success":
            await handleTransferSuccess(event.data.reference)
            break

        case "transfer.failed":
        case "transfer.reversed":
            await handleTransferFailure(event.data.reference, event.event)
            break

        default:
            break
    }

    return NextResponse.json({ received: true })
}

async function handleTransferSuccess(reference?: string) {
    if (!reference) return

    const updated = await prisma.withdrawal.updateMany({
        where: { transferReference: reference, status: "PROCESSING" },
        data:  { status: "PAID", paidAt: new Date() },
    })
    if (updated.count === 0) return

    const withdrawal = await prisma.withdrawal.findUnique({
        where:   { transferReference: reference },
        include: { creator: { select: { userId: true } } },
    })
    if (!withdrawal) return

    await prisma.notification.create({
        data: {
            userId: withdrawal.creator.userId,
            type:   "PAYOUT_PROCESSED",
            title:  "Payout sent 🎉",
            body:   `₦${Number(withdrawal.netAmount).toLocaleString()} has been sent to your bank account.`,
            href:   "/creator/monetization/payouts",
        },
    })
}

async function handleTransferFailure(reference: string | undefined, eventName: string) {
    if (!reference) return

    const withdrawal = await prisma.withdrawal.findUnique({
        where:   { transferReference: reference },
        include: { creator: { select: { id: true, userId: true, wallet: { select: { id: true } } } } },
    })
    if (!withdrawal || !withdrawal.creator.wallet) return

    const gross    = Number(withdrawal.grossAmount)
    const walletId = withdrawal.creator.wallet.id

    await prisma.$transaction(async (tx) => {
        const updated = await tx.withdrawal.updateMany({
            where: {
                transferReference: reference,
                status: { in: ["PROCESSING", "PAID"] },
            },
            data: {
                status:        "FAILED",
                failureReason: `Paystack ${eventName}`,
            },
        })
        if (updated.count === 0) return 

        await tx.creatorWallet.update({
            where: { creatorId: withdrawal.creator.id },
            data:  { balance: { increment: gross } },
        })

        await tx.creatorWalletTransaction.create({
            data: {
                walletId,
                amount:      gross,
                type:        "REFUND",
                description: "Bank transfer failed — funds returned to wallet.",
            },
        })

        await tx.notification.create({
            data: {
                userId: withdrawal.creator.userId,
                type:   "SYSTEM",
                title:  "Payout failed",
                body:   `Your ₦${Number(withdrawal.netAmount).toLocaleString()} payout could not be completed. Funds have been returned to your wallet — please check your bank details and try again.`,
                href:   "/creator/monetization/wallet",
            },
        })
    })
}