// actions/creator/settings.ts
"use server"

import { prisma }   from "@/lib/prisma"
import { requireAuth, requireCreator, validateInput } from "@/lib/action-utils"
import { z }        from "zod"
import bcrypt       from "bcryptjs"
import { signOut }  from "@/lib/auth"

// ── Get settings data ─────────────────────────────────────────────────────────

export async function getSettingsAction() {
    const userId = await requireAuth()

    const [user, creatorRaw] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id:            true,
                email:         true,
                firstName:     true,
                lastName:      true,
                username:      true,
                emailVerified: true,
                password:      true,
                accounts:      { select: { provider: true } },
            },
        }),
        prisma.creator.findUnique({
            where: { userId },
            select: {
                id:                   true,
                subscriptionEnabled:  true,
                subscriptionPrice:    true,
                subscriberDMsEnabled: true as any,
                subscriberDMPrice:    true as any,
            },
        }),
    ])

    const isGoogleAccount = user?.accounts.some((a) => a.provider === "google") ?? false
    const hasPassword     = !!user?.password

    // Safe extraction
    const creator = {
        id: creatorRaw?.id ?? "",
        subscriptionEnabled: creatorRaw?.subscriptionEnabled ?? false,
        subscriptionPrice: creatorRaw?.subscriptionPrice,
        subscriberDMsEnabled: (creatorRaw as any)?.subscriberDMsEnabled ?? false,
        subscriberDMPrice: (creatorRaw as any)?.subscriberDMPrice,
    }

    return { 
        user, 
        creator, 
        isGoogleAccount, 
        hasPassword 
    }
}

// ── Update account info ───────────────────────────────────────────────────────

const AccountSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName:  z.string().min(1, "Last name is required"),
    email:     z.string().email("Enter a valid email"),
})

export async function updateAccountAction(data: z.infer<typeof AccountSchema>) {
    const userId = await requireAuth()
    const session = await (await import("@/lib/auth")).auth()

    const result = validateInput(AccountSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    if (parsed.data.email !== session?.user?.email) {
        const existing = await prisma.user.findUnique({
            where: { email: parsed.data.email },
        })
        if (existing) return { error: "This email is already in use." }
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            firstName: parsed.data.firstName,
            lastName:  parsed.data.lastName,
            email:     parsed.data.email,
            name:      `${parsed.data.firstName} ${parsed.data.lastName}`,
        },
    })

    return { success: true }
}

// ── Change password ───────────────────────────────────────────────────────────

const PasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword:     z.string()
        .min(8, "Must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number")
        .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

export async function changePasswordAction(data: z.infer<typeof PasswordSchema>) {
    const userId = await requireAuth()

    const result = validateInput(PasswordSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
    })

    if (!user?.password) return { error: "No password set on this account." }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
    if (!valid) return { error: "Current password is incorrect." }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12)

    await prisma.user.update({
        where: { id: userId },
        data: { password: hashed },
    })

    return { success: true }
}

// ── Creator monetization settings ─────────────────────────────────────────────

const MonetizationSchema = z.object({
    subscriptionEnabled:  z.boolean(),
    subscriptionPrice:    z.number().min(0).optional(),
    subscriberDMsEnabled: z.boolean(),
    subscriberDMPrice:    z.number().min(0).optional(),
})

export async function updateMonetizationSettingsAction(
    data: z.infer<typeof MonetizationSchema>
) {
    const userId = await requireAuth()

    const result = validateInput(MonetizationSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await requireCreator(userId)

    // Use raw update to avoid type issues for now
    await prisma.$executeRaw`
        UPDATE creators 
        SET 
            "subscriptionEnabled" = ${parsed.data.subscriptionEnabled},
            "subscriptionPrice" = ${parsed.data.subscriptionPrice ?? null},
            "subscriberDMsEnabled" = ${parsed.data.subscriberDMsEnabled},
            "subscriberDMPrice" = ${parsed.data.subscriberDMPrice ?? null},
            "updatedAt" = NOW()
        WHERE id = ${creator.id}
    `

    return { success: true }
}

// ── Notification preferences ──────────────────────────────────────────────────

export async function getNotificationPrefsAction() {
    await requireAuth()

    return {
        newFollower:       true,
        newSubscriber:     true,
        newMessage:        true,
        giftReceived:      true,
        payoutProcessed:   true,
        emailNewFollower:  false,
        emailNewSubscriber: true,
        emailPayout:       true,
    }
}

export async function updateNotificationPrefsAction(prefs: Record<string, boolean>) {
    await requireAuth()

    // TODO: Implement persistence later
    return { success: true }
}

// ── Delete account ────────────────────────────────────────────────────────────

export async function deleteAccountAction(password: string) {
    const userId = await requireAuth()

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
    })

    if (user?.password) {
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return { error: "Incorrect password." }
    }

    await prisma.user.delete({ where: { id: userId } })
    await signOut({ redirectTo: "/" })
}