// actions/creator/profile.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) redirect("/onboarding")
    return creator
}

// ── Get full profile ──────────────────────────────────────────────────────────

export async function getCreatorProfileAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const [creator, user] = await Promise.all([
        prisma.creator.findUnique({
            where: { userId: session.user.id },
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
            where:  { id: session.user.id },
            select: {
                firstName: true,
                lastName:  true,
                username:  true,
                email:     true,
                image:     true,
            },
        }),
    ])

    if (!creator) redirect("/onboarding")

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = BasicProfileSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    if (!imageUrl) return { error: "Image URL is required." }

    await prisma.user.update({
        where: { id: session.user.id },
        data:  { image: imageUrl },
    })

    return { success: true, image: imageUrl }
}

// ── Update banner ─────────────────────────────────────────────────────────────

export async function updateBannerAction(bannerUrl: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    if (!bannerUrl) return { error: "Banner URL is required." }

    const creator = await getCreatorOrThrow(session.user.id)

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = SocialLinksSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = BrandingSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)

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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    if (!username.match(/^[a-zA-Z0-9_]{3,30}$/)) {
        return { error: "Username must be 3-30 characters, letters, numbers and underscores only." }
    }

    const existing = await prisma.user.findUnique({
        where: { username },
    })
    if (existing && existing.id !== session.user.id) {
        return { error: "This username is already taken." }
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data:  { username },
    })

    return { success: true, username }
}