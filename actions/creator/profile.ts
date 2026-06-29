// actions/creator/profile.ts
"use server"

import { prisma }   from "@/lib/prisma"
import { requireAuth, requireCreator, validateInput } from "@/lib/action-utils"
import { z }        from "zod"

// ── Get full profile ──────────────────────────────────────────────────────────

export async function getCreatorProfileAction() {
    const userId = await requireAuth()

    const [creator, user] = await Promise.all([
        prisma.creator.findUnique({
            where: { userId },
            include: {
                creatorCategories: { select: { category: true } },
                _count: {
                    select: {
                        followers:   true,
                        subscribers: true,
                        posts:       true,
                    },
                },
            },
        }),
        prisma.user.findUnique({
            where:  { id: userId },
            select: {
                firstName: true,
                lastName:  true,
                username:  true,
                email:     true,
                image:     true,
            },
        }),
    ])

    if (!creator) return requireCreator(userId) as never

    return {
        creator: {
            ...creator,
            profileTheme: creator.profileTheme.toLowerCase(),
        },
        user,
    }
}

// ── Update basic profile ──────────────────────────────────────────────────────

const BasicProfileSchema = z.object({
    displayName: z.string().min(1, "Display name is required").max(50),
    bio:         z.string().max(500).optional(),
    websiteUrl:  z.string().url("Enter a valid URL").optional().or(z.literal("")),
    links:       z.array(z.string().url()).max(5).optional(),
})

export async function updateBasicProfileAction(
    data: z.infer<typeof BasicProfileSchema>
) {
    const userId = await requireAuth()

    const result = validateInput(BasicProfileSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await requireCreator(userId)

    await prisma.creator.update({
        where: { id: creator.id },
        data: {
            displayName: parsed.data.displayName,
            bio:         parsed.data.bio,
            websiteUrl:  parsed.data.websiteUrl || null,
            links:       parsed.data.links ?? [],
        },
    })

    return { success: true }
}

// ── Update avatar ─────────────────────────────────────────────────────────────
// Updates User.image (single source of truth for avatar)
// Returns the new URL so the client can sync the session immediately via update()

export async function updateAvatarAction(imageUrl: string) {
    const userId = await requireAuth()

    if (!imageUrl) return { error: "Image URL is required." }

    await prisma.user.update({
        where: { id: userId },
        data:  { image: imageUrl },
    })

    return { success: true, image: imageUrl }
}

// ── Update banner ─────────────────────────────────────────────────────────────

export async function updateBannerAction(bannerUrl: string) {
    const userId = await requireAuth()

    if (!bannerUrl) return { error: "Banner URL is required." }

    const creator = await requireCreator(userId)

    await prisma.creator.update({
        where: { id: creator.id },
        data:  { bannerImage: bannerUrl },
    })

    return { success: true }
}

// ── Update social links ───────────────────────────────────────────────────────

const SocialLinksSchema = z.object({
    instagramUrl: z.string().url().optional().or(z.literal("")),
    twitterUrl:   z.string().url().optional().or(z.literal("")),
    tiktokUrl:    z.string().url().optional().or(z.literal("")),
    youtubeUrl:   z.string().url().optional().or(z.literal("")),
})

export async function updateSocialLinksAction(
    data: z.infer<typeof SocialLinksSchema>
) {
    const userId = await requireAuth()

    const result = validateInput(SocialLinksSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await requireCreator(userId)

    await prisma.creator.update({
        where: { id: creator.id },
        data: {
            instagramUrl: parsed.data.instagramUrl || null,
            twitterUrl:   parsed.data.twitterUrl   || null,
            tiktokUrl:    parsed.data.tiktokUrl     || null,
            youtubeUrl:   parsed.data.youtubeUrl    || null,
        },
    })

    return { success: true }
}

// ── Update branding ───────────────────────────────────────────────────────────

const BrandingSchema = z.object({
    accentColor:  z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color").optional(),
    profileTheme: z.enum(["light", "dark"]).optional(),
})

export async function updateBrandingAction(
    data: z.infer<typeof BrandingSchema>
) {
    const userId = await requireAuth()

    const result = validateInput(BrandingSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await requireCreator(userId)

    await prisma.creator.update({
        where: { id: creator.id },
        data: {
            accentColor:  parsed.data.accentColor,
            profileTheme: parsed.data.profileTheme?.toUpperCase() as "LIGHT" | "DARK" | undefined,
        },
    })

    return { success: true }
}

// ── Update username ───────────────────────────────────────────────────────────
// Updating username also syncs creator.handle via the Prisma extension in lib/prisma.ts

export async function updateUsernameAction(username: string) {
    const userId = await requireAuth()

    if (!username.match(/^[a-zA-Z0-9_]{3,30}$/)) {
        return { error: "Username must be 3-30 characters, letters, numbers and underscores only." }
    }

    const existing = await prisma.user.findUnique({
        where: { username },
    })
    if (existing && existing.id !== userId) {
        return { error: "This username is already taken." }
    }

    await prisma.user.update({
        where: { id: userId },
        data:  { username },
    })

    return { success: true, username }
}