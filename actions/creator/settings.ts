// actions/creator/settings.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"
import bcrypt       from "bcryptjs"
import { signOut }  from "@/lib/auth"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({
        where: { userId },
        select: {
            id: true,
            subscriptionEnabled: true,
            subscriptionPrice: true,
            // These two may not be in your current Prisma client yet
            subscriberDMsEnabled: true as any,
            subscriberDMPrice: true as any,
        },
    })

    if (!creator) redirect("/onboarding")
    return creator
}

// ── Get settings data ─────────────────────────────────────────────────────────

export async function getSettingsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const [user, creatorRaw] = await Promise.all([
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id:            true,
                email:         true,
                firstName:     true,
                lastName:      true,
                username:      true,
                emailVerified: true,
                password:      false,
                accounts:      { select: { provider: true } },
            },
        }),
        prisma.creator.findUnique({
            where: { userId: session.user.id },
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

    const passwordCheck = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
    })
    const hasPassword = !!passwordCheck?.password

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = AccountSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    if (parsed.data.email !== session.user.email) {
        const existing = await prisma.user.findUnique({
            where: { email: parsed.data.email },
        })
        if (existing) return { error: "This email is already in use." }
    }

    await prisma.user.update({
        where: { id: session.user.id },
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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = PasswordSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true },
    })

    if (!user?.password) return { error: "No password set on this account." }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
    if (!valid) return { error: "Current password is incorrect." }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12)

    await prisma.user.update({
        where: { id: session.user.id },
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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = MonetizationSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)

    await prisma.creator.update({
        where: { id: creator.id },
        data: {
            subscriptionEnabled:  parsed.data.subscriptionEnabled,
            subscriptionPrice:    parsed.data.subscriptionPrice ?? null,
            subscriberDMsEnabled: parsed.data.subscriberDMsEnabled,
            subscriberDMPrice:    parsed.data.subscriberDMPrice ?? null,
        },
    })

    return { success: true }
}

// ── Notification preferences ──────────────────────────────────────────────────

export async function getNotificationPrefsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // TODO: Implement persistence later
    return { success: true }
}

// ── Delete account ────────────────────────────────────────────────────────────

export async function deleteAccountAction(password: string, confirmEmail?: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { password: true, email: true },
    })

    if (!user) return { error: "User not found." }

    if (user.password) {
        if (!password) return { error: "Password is required." }
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return { error: "Incorrect password." }
    } else {
        if (!confirmEmail || confirmEmail !== user.email) {
            return { error: "Please confirm your email address to delete your account." }
        }
    }

    await prisma.user.delete({ where: { id: session.user.id } })
    await signOut({ redirectTo: "/" })
}