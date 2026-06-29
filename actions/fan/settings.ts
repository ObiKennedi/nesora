"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"
import bcrypt       from "bcryptjs"
import { signOut }  from "@/lib/auth"
import { Category } from "@prisma/client"

// ── Get settings data ─────────────────────────────────────────────────────────

export async function getFanSettingsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            id:            true,
            email:         true,
            firstName:     true,
            lastName:      true,
            username:      true,
            image:         true,
            emailVerified: true,
            password:      true,
            accounts:      { select: { provider: true } },
            categoryInterests: { select: { category: true } },
        },
    })

    if (!user) redirect("/login")

    const isGoogleAccount = user.accounts.some((a) => a.provider === "google")
    const hasPassword     = !!user.password

    return {
        user: {
            id:        user.id,
            email:     user.email,
            firstName: user.firstName,
            lastName:  user.lastName,
            username:  user.username,
            image:     user.image,
        },
        interests:       user.categoryInterests.map((c) => c.category),
        isGoogleAccount,
        hasPassword,
    }
}

// ── Update account info ───────────────────────────────────────────────────────

const AccountSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName:  z.string().min(1, "Last name is required"),
    email:     z.string().email("Enter a valid email"),
})

export async function updateFanAccountAction(data: z.infer<typeof AccountSchema>) {
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

// ── Update username ───────────────────────────────────────────────────────────
// Checks both user.username and creator.handle to prevent collisions

export async function checkFanUsernameAvailability(username: string) {
    const clean = username.toLowerCase()

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(clean)) {
        return { available: false, error: "3-30 characters, letters/numbers/underscores only." }
    }

    const session = await auth()

    const [existingUser, existingCreator] = await Promise.all([
        prisma.user.findUnique({ where: { username: clean }, select: { id: true } }),
        prisma.creator.findUnique({ where: { handle: clean }, select: { id: true } }),
    ])

    const userConflict    = existingUser && existingUser.id !== session?.user?.id
    const creatorConflict = !!existingCreator

    return { available: !userConflict && !creatorConflict, error: null }
}

export async function updateFanUsernameAction(username: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const clean = username.toLowerCase()

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(clean)) {
        return { error: "Username must be 3-30 characters, letters, numbers and underscores only." }
    }

    const [existingUser, existingCreator] = await Promise.all([
        prisma.user.findUnique({ where: { username: clean }, select: { id: true } }),
        prisma.creator.findUnique({ where: { handle: clean }, select: { id: true } }),
    ])

    if (existingUser && existingUser.id !== session.user.id) {
        return { error: "This username is already taken." }
    }
    if (existingCreator) {
        return { error: "This username is already taken." }
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data:  { username: clean },
    })

    return { success: true, username: clean }
}

// ── Update avatar ─────────────────────────────────────────────────────────────

export async function updateFanAvatarAction(imageUrl: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    if (!imageUrl) return { error: "Image URL is required." }

    await prisma.user.update({
        where: { id: session.user.id },
        data:  { image: imageUrl },
    })

    return { success: true, image: imageUrl }
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
    path:    ["confirmPassword"],
})

export async function changeFanPasswordAction(data: z.infer<typeof PasswordSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = PasswordSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { password: true },
    })

    if (!user?.password) return { error: "No password set on this account." }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
    if (!valid) return { error: "Current password is incorrect." }

    const hashed = await bcrypt.hash(parsed.data.newPassword, 12)

    await prisma.user.update({
        where: { id: session.user.id },
        data:  { password: hashed },
    })

    return { success: true }
}

// ── Update interests ──────────────────────────────────────────────────────────

export async function updateFanInterestsAction(categories: Category[]) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    if (categories.length < 1) return { error: "Pick at least one interest." }
    if (categories.length > 10) return { error: "Maximum 10 interests." }

    await prisma.$transaction([
        prisma.userCategoryInterest.deleteMany({
            where: { userId: session.user.id },
        }),
        prisma.userCategoryInterest.createMany({
            data: categories.map((category) => ({
                userId: session.user.id,
                category,
            })),
        }),
    ])

    return { success: true }
}

// ── Get saved posts ───────────────────────────────────────────────────────────

export async function getSavedPostsAction(params?: {
    page?:  number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 12
    const skip  = (page - 1) * limit

    const [saves, total] = await Promise.all([
        prisma.postSave.findMany({
            where:   { userId: session.user.id },
            orderBy: { createdAt: "desc" },
            skip,
            take:    limit,
            include: {
                post: {
                    select: {
                        id:            true,
                        type:          true,
                        title:         true,
                        body:          true,
                        thumbnailUrl:  true,
                        mediaUrls:     true,
                        likeCount:     true,
                        commentCount:  true,
                        videoDuration: true,
                        publishedAt:   true,
                        creator: {
                            select: {
                                displayName: true,
                                handle:      true,
                                user:        { select: { image: true } },
                            },
                        },
                    },
                },
            },
        }),
        prisma.postSave.count({ where: { userId: session.user.id } }),
    ])

    return {
        posts: saves.map((s) => ({
            id:            s.post.id,
            type:          s.post.type,
            title:         s.post.title,
            body:          s.post.body,
            thumbnailUrl:  s.post.thumbnailUrl,
            mediaUrls:     s.post.mediaUrls,
            likeCount:     s.post.likeCount,
            commentCount:  s.post.commentCount,
            videoDuration: s.post.videoDuration,
            publishedAt:   s.post.publishedAt,
            creator: {
                displayName: s.post.creator.displayName,
                handle:      s.post.creator.handle,
                image:       s.post.creator.user.image,
            },
        })),
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

// ── Notification preferences ──────────────────────────────────────────────────
// Stored as defaults for now — persistence layer can be added later

export async function getFanNotificationPrefsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    return {
        newPostFromFollowed:   true,
        creatorGoesLive:       true,
        subscriptionExpiring:  true,
        messageReceived:       true,
        emailNewPost:          false,
        emailSubscription:     true,
    }
}

export async function updateFanNotificationPrefsAction(prefs: Record<string, boolean>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // TODO: persist when a NotificationPreference model is added
    return { success: true }
}

// ── Delete account ────────────────────────────────────────────────────────────

export async function deleteFanAccountAction(password?: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { password: true },
    })

    // If they have a password, verify it
    if (user?.password) {
        if (!password) return { error: "Password is required to delete your account." }
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) return { error: "Incorrect password." }
    }

    await prisma.user.delete({ where: { id: session.user.id } })
    await signOut({ redirectTo: "/" })
}