"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"
import { pusherServer } from "@/lib/pusher"

// ── Get fan wallet ────────────────────────────────────────────────────────────

export async function getFanWalletAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const wallet = await prisma.userWallet.findUnique({
        where:  { userId: session.user.id },
        select: { balance: true },
    })

    const transactions = await prisma.userWalletTransaction.findMany({
        where:   { wallet: { userId: session.user.id } },
        orderBy: { createdAt: "desc" },
        take:    5,
        select: {
            id:          true,
            amount:      true,
            type:        true,
            description: true,
            createdAt:   true,
        },
    })

    return {
        balance:      Number(wallet?.balance ?? 0),
        transactions: transactions.map((t) => ({
            ...t,
            amount: Number(t.amount),
        })),
    }
}

// ── Get full transaction history ──────────────────────────────────────────────

export async function getFanTransactionHistoryAction(params?: {
    page?:  number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 20
    const skip  = (page - 1) * limit

    const [transactions, total] = await Promise.all([
        prisma.userWalletTransaction.findMany({
            where:   { wallet: { userId: session.user.id } },
            orderBy: { createdAt: "desc" },
            skip,
            take:    limit,
            select: {
                id:          true,
                amount:      true,
                type:        true,
                description: true,
                createdAt:   true,
            },
        }),
        prisma.userWalletTransaction.count({
            where: { wallet: { userId: session.user.id } },
        }),
    ])

    return {
        transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

// ── Initialize Paystack transaction ──────────────────────────────────────────

const TopUpSchema = z.object({
    amount: z.number().min(100, "Minimum top-up is ₦100"),
})

export async function initializePaystackAction(amount: number) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = TopUpSchema.safeParse({ amount })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { email: true, firstName: true, lastName: true },
    })
    if (!user) return { error: "User not found." }

    // Initialize with Paystack REST API
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
        method:  "POST",
        headers: {
            Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            email:    user.email,
            amount:   parsed.data.amount * 100, // Paystack uses kobo
            metadata: {
                userId:      session.user.id,
                type:        "wallet_topup",
                custom_fields: [
                    {
                        display_name: "Full Name",
                        variable_name: "full_name",
                        value: `${user.firstName} ${user.lastName}`,
                    },
                ],
            },
        }),
    })

    const data = await res.json()
    if (!data.status) return { error: data.message ?? "Failed to initialize payment." }

    return {
        success:    true,
        accessCode: data.data.access_code,
        reference:  data.data.reference,
        email:      user.email,
        amount:     parsed.data.amount,
    }
}

// ── Verify Paystack payment and credit wallet ─────────────────────────────────

export async function verifyPaystackPaymentAction(reference: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })

    const data = await res.json()

    if (!data.status || data.data.status !== "success") {
        return { error: "Payment verification failed." }
    }

    const amountNaira = data.data.amount / 100 // convert from kobo
    const userId      = data.data.metadata?.userId

    if (userId !== session.user.id) return { error: "User mismatch." }

    // Idempotency — check if this reference was already processed
    const existing = await prisma.userWalletTransaction.findFirst({
        where: { description: { contains: reference } },
    })
    if (existing) return { success: true, alreadyProcessed: true }

    // Upsert wallet and credit
    const wallet = await prisma.userWallet.upsert({
        where:  { userId: session.user.id },
        update: { balance: { increment: amountNaira } },
        create: { userId: session.user.id, balance: amountNaira },
    })

    await prisma.userWalletTransaction.create({
        data: {
            walletId:    wallet.id,
            amount:      amountNaira,
            type:        "DEPOSIT",
            description: `Paystack top-up · ref:${reference}`,
        },
    })

    return { success: true, balance: Number(wallet.balance) }
}

// ── Get all gifts ─────────────────────────────────────────────────────────────

export async function getGiftsAction() {
    const gifts = await prisma.gift.findMany({
        where:   { isActive: true },
        orderBy: { value: "asc" },
        select: {
            id:      true,
            name:    true,
            emoji:   true,
            value:   true,
            imageUrl: true,
        },
    })

    return gifts.map((g) => ({ ...g, value: Number(g.value) }))
}

// ── Get creator info for gift modal ──────────────────────────────────────────

export async function getCreatorForGiftAction(creatorId: string) {
    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: {
            id:          true,
            displayName: true,
            handle:      true,
            isVerified:  true,
            user:        { select: { image: true } },
        },
    })
    if (!creator) return null

    return {
        id:          creator.id,
        displayName: creator.displayName,
        handle:      creator.handle,
        isVerified:  creator.isVerified,
        image:       creator.user.image,
    }
}

// ── Send gift ─────────────────────────────────────────────────────────────────

const SendGiftSchema = z.object({
    creatorId: z.string().min(1),
    giftId:    z.string().min(1),
    quantity:  z.number().int().min(1).max(100).default(1),
})

export async function sendGiftAction(data: z.infer<typeof SendGiftSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = SendGiftSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const { creatorId, giftId, quantity } = parsed.data
    const userId = session.user.id

    // Get gift details
    const gift = await prisma.gift.findUnique({
        where:  { id: giftId },
        select: { id: true, name: true, emoji: true, value: true, isActive: true },
    })
    if (!gift || !gift.isActive) return { error: "Gift not found." }

    const totalAmount = Number(gift.value) * quantity

    // Get fan wallet
    const wallet = await prisma.userWallet.findUnique({
        where:  { userId },
        select: { id: true, balance: true },
    })

    if (!wallet) return {
        error:    "INSUFFICIENT_FUNDS",
        needed:   totalAmount,
        balance:  0,
        shortfall: totalAmount,
    }

    const balance = Number(wallet.balance)
    if (balance < totalAmount) return {
        error:     "INSUFFICIENT_FUNDS",
        needed:    totalAmount,
        balance,
        shortfall: totalAmount - balance,
    }

    // Get creator + creator wallet
    const creator = await prisma.creator.findUnique({
        where:   { id: creatorId },
        include: { wallet: true, user: { select: { id: true } } },
    })
    if (!creator) return { error: "Creator not found." }

    // Ensure creator wallet exists
    const creatorWallet = creator.wallet ?? await prisma.creatorWallet.create({
        data: { creatorId, balance: 0 },
    })

    // Execute in a transaction
    await prisma.$transaction([
        // Deduct from fan wallet
        prisma.userWallet.update({
            where: { userId },
            data:  { balance: { decrement: totalAmount } },
        }),

        // Fan wallet transaction
        prisma.userWalletTransaction.create({
            data: {
                walletId:    wallet.id,
                amount:      totalAmount,
                type:        "GIFT_PURCHASE",
                description: `Sent ${quantity}x ${gift.emoji} ${gift.name} to creator`,
            },
        }),

        // Credit creator wallet
        prisma.creatorWallet.update({
            where: { creatorId },
            data:  { balance: { increment: totalAmount } },
        }),

        // Creator wallet transaction
        prisma.creatorWalletTransaction.create({
            data: {
                walletId:    creatorWallet.id,
                amount:      totalAmount,
                type:        "GIFT_RECEIVED",
                description: `Received ${quantity}x ${gift.emoji} ${gift.name} from fan`,
            },
        }),

        // Gift transaction record
        prisma.giftTransaction.create({
            data: {
                senderId:  userId,
                creatorId,
                giftId,
                quantity,
                amount:    totalAmount,
            },
        }),

        // Notify creator
        prisma.notification.create({
            data: {
                userId: creator.user.id,
                type:   "GIFT_RECEIVED",
                title:  "You received a gift!",
                body:   `Someone sent you ${quantity}x ${gift.emoji} ${gift.name} (₦${totalAmount.toLocaleString()})`,
                href:   "/creator/monetization/wallet",
            },
        }),
    ])

    // Pusher — real-time gift notification to creator
    await pusherServer.trigger(
        `private-user-${creator.user.id}`,
        "gift-received",
        {
            giftName:    gift.name,
            giftEmoji:   gift.emoji,
            quantity,
            totalAmount,
        }
    )

    return { success: true, gift: { name: gift.name, emoji: gift.emoji }, quantity, totalAmount }
}