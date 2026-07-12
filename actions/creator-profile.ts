"use server"

import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { z }      from "zod"

const GRID_PAGE_SIZE = 12
const TOP_FAN_LIMIT  = 50

export type PublicProfileCreator = {
    id:                  string
    displayName:         string
    username:            string
    bio:                 string | null
    isVerified:          boolean
    image:               string | null
    bannerImage:         string | null
    websiteUrl:          string | null
    accentColor:         string | null
    followersCount:      number
    subscribersCount:    number
    postsCount:          number
    categories:          string[]
    subscriptionEnabled: boolean
    plans: {
        id:       string
        name:     string
        price:    number
        interval: string
        benefits: string[]
    }[]
    socials: {
        instagram: string | null
        twitter:   string | null
        tiktok:    string | null
        youtube:   string | null
    }
}

export type PublicProfileViewer = {
    isAuthenticated: boolean
    isOwnProfile:    boolean
    isFollowing:     boolean
    isSubscribed:    boolean
}

export type PublicProfileResult =
    | { status: "not_found" }
    | { status: "success"; creator: PublicProfileCreator; viewer: PublicProfileViewer }

export type GridPost = {
    id:            string
    type:          "TEXT" | "PHOTO" | "VIDEO" | "AUDIO" | "POLL"
    thumbnailUrl:  string | null
    previewUrl:    string | null
    snippet:       string | null
    mediaCount:    number
    videoDuration: number | null
    likeCount:     number
    commentCount:  number
    accessLevel:   "PUBLIC" | "FOLLOWERS_ONLY" | "SUBSCRIBERS_ONLY" | "PLAN_SPECIFIC" | "TOP_FANS_ONLY"
    unlocked:      boolean
    publishedAt:   Date | null
}

export type GridPostsResult =
    | { status: "not_found" }
    | { status: "error"; message: string }
    | { status: "success"; posts: GridPost[]; nextCursor: string | null }

// Full post payload for the profile lightbox. Gated fields are nulled/emptied
// server-side when locked — same principle as the grid, never trust the client.
export type ModalPost = {
    id:            string
    type:          "TEXT" | "PHOTO" | "VIDEO" | "AUDIO" | "POLL"
    title:         string | null
    body:          string | null
    mediaUrls:     string[]
    thumbnailUrl:  string | null
    videoDuration: number | null
    likeCount:     number
    commentCount:  number
    accessLevel:   GridPost["accessLevel"]
    unlocked:      boolean
    publishedAt:   Date | null
}

export type ModalPostResult =
    | { status: "not_found" }
    | { status: "error"; message: string }
    | { status: "success"; post: ModalPost }

export type FollowResult =
    | { status: "unauthenticated" }
    | { status: "error"; message: string }
    | { status: "success"; following: boolean; followersCount: number }

async function resolveCreatorIdentifier(identifier: string) {
    const user = await prisma.user.findUnique({
        where:  { username: identifier },
        select: { id: true, username: true, creator: { select: { id: true } } },
    })
    if (user?.creator) {
        return { creatorId: user.creator.id, ownerUserId: user.id, username: user.username }
    }

    const creator = await prisma.creator.findUnique({
        where:  { id: identifier },
        select: { id: true, userId: true, user: { select: { username: true } } },
    })
    if (creator) {
        return { creatorId: creator.id, ownerUserId: creator.userId, username: creator.user.username }
    }

    return null
}

async function getViewerContext(creatorId: string, userId: string | null) {
    if (!userId) {
        return {
            isFollowing:  false,
            subscription: null as null | { planId: string | null; subscriptionPlanId: string | null },
        }
    }

    const [follow, subscription] = await Promise.all([
        prisma.follow.findUnique({
            where:  { userId_creatorId: { userId, creatorId } },
            select: { id: true },
        }),
        prisma.subscription.findFirst({
            where:  { userId, creatorId, status: "ACTIVE", expiresAt: { gt: new Date() } },
            select: { planId: true, subscriptionPlanId: true },
        }),
    ])

    return { isFollowing: !!follow, subscription }
}

async function isTopFan(creatorId: string, userId: string): Promise<boolean> {
    const topFans = await prisma.giftTransaction.groupBy({
        by:      ["senderId"],
        where:   { creatorId },
        _sum:    { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take:    TOP_FAN_LIMIT,
    })
    return topFans.some((f) => f.senderId === userId)
}

// ── Shared access resolution ──────────────────────────────────────────────────
// Single source of truth for "can this viewer see this post's content".
// Used by both the grid and the modal so the two can never drift apart.

type AccessInput = {
    accessLevel:    GridPost["accessLevel"]
    allowedPlanIds: string[]
}

type AccessContext = {
    isOwnProfile:  boolean
    isPurchased:   boolean
    isFollowing:   boolean
    isSubscribed:  boolean
    viewerPlanId:  string | null
    viewerIsTopFan: boolean
}

function resolvePostUnlocked(access: AccessInput, ctx: AccessContext): boolean {
    if (ctx.isOwnProfile) return true
    if (ctx.isPurchased)  return true

    switch (access.accessLevel) {
        case "PUBLIC":
            return true
        case "FOLLOWERS_ONLY":
            return ctx.isFollowing || ctx.isSubscribed
        case "SUBSCRIBERS_ONLY":
            return ctx.isSubscribed
        case "PLAN_SPECIFIC":
            return !!ctx.viewerPlanId && access.allowedPlanIds.includes(ctx.viewerPlanId)
        case "TOP_FANS_ONLY":
            return ctx.viewerIsTopFan
        default:
            return false
    }
}

export async function getPublicCreatorProfileAction(identifier: string): Promise<PublicProfileResult> {
    const session  = await auth()
    const viewerId = session?.user?.id ?? null

    const resolved = await resolveCreatorIdentifier(identifier)
    if (!resolved) return { status: "not_found" }

    const creator = await prisma.creator.findUnique({
        where: { id: resolved.creatorId },
        select: {
            id:                  true,
            displayName:         true,
            bio:                 true,
            isVerified:          true,
            bannerImage:         true,
            websiteUrl:          true,
            accentColor:         true,
            followersCount:      true,
            subscribersCount:    true,
            subscriptionEnabled: true,
            instagramUrl:        true,
            twitterUrl:          true,
            tiktokUrl:           true,
            youtubeUrl:          true,
            user:                { select: { image: true } },
            creatorCategories:   { select: { category: true } },
            subscriptionPlans: {
                where:   { isActive: true },
                orderBy: { price: "asc" },
                select:  { id: true, name: true, price: true, interval: true, benefits: true },
            },
            _count: {
                select: { posts: { where: { status: "PUBLISHED" } } },
            },
        },
    })
    if (!creator) return { status: "not_found" }

    const { isFollowing, subscription } = await getViewerContext(creator.id, viewerId)

    return {
        status: "success",
        creator: {
            id:                  creator.id,
            displayName:         creator.displayName,
            username:            resolved.username,
            bio:                 creator.bio,
            isVerified:          creator.isVerified,
            image:               creator.user.image,
            bannerImage:         creator.bannerImage,
            websiteUrl:          creator.websiteUrl,
            accentColor:         creator.accentColor,
            followersCount:      creator.followersCount,
            subscribersCount:    creator.subscribersCount,
            postsCount:          creator._count.posts,
            categories:          creator.creatorCategories.map((c) => c.category),
            subscriptionEnabled: creator.subscriptionEnabled,
            plans: creator.subscriptionPlans.map((p) => ({
                id:       p.id,
                name:     p.name,
                price:    Number(p.price),
                interval: p.interval,
                benefits: p.benefits,
            })),
            socials: {
                instagram: creator.instagramUrl,
                twitter:   creator.twitterUrl,
                tiktok:    creator.tiktokUrl,
                youtube:   creator.youtubeUrl,
            },
        },
        viewer: {
            isAuthenticated: !!viewerId,
            isOwnProfile:    viewerId === resolved.ownerUserId,
            isFollowing,
            isSubscribed:    !!subscription,
        },
    }
}

const GridSchema = z.object({
    identifier: z.string().min(1), // username or creator id
    tab:        z.enum(["posts", "shorts"]),
    cursor:     z.string().nullable().optional(),
})

export async function getCreatorGridPostsAction(
    data: z.infer<typeof GridSchema>
): Promise<GridPostsResult> {
    const parsed = GridSchema.safeParse(data)
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message }

    const { identifier, tab, cursor } = parsed.data

    const session  = await auth()
    const viewerId = session?.user?.id ?? null

    const resolved = await resolveCreatorIdentifier(identifier)
    if (!resolved) return { status: "not_found" }

    const { creatorId, ownerUserId } = resolved
    const isOwnProfile = viewerId === ownerUserId

    const posts = await prisma.post.findMany({
        where: {
            creatorId,
            status: "PUBLISHED",
            ...(tab === "shorts" ? { type: "VIDEO" } : {}),
        },
        orderBy: { publishedAt: "desc" },
        take:    GRID_PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
            id:            true,
            type:          true,
            body:          true,
            title:         true,
            thumbnailUrl:  true,
            mediaUrls:     true,
            videoDuration: true,
            likeCount:     true,
            commentCount:  true,
            publishedAt:   true,
            access:        { select: { accessLevel: true, allowedPlanIds: true } },
        },
    })

    const hasMore   = posts.length > GRID_PAGE_SIZE
    const pagePosts = hasMore ? posts.slice(0, GRID_PAGE_SIZE) : posts

    const [{ isFollowing, subscription }, purchases] = await Promise.all([
        getViewerContext(creatorId, viewerId),
        viewerId
            ? prisma.postPurchase.findMany({
                where:  { userId: viewerId, postId: { in: pagePosts.map((p) => p.id) } },
                select: { postId: true },
            })
            : Promise.resolve([] as { postId: string }[]),
    ])
    const purchasedIds = new Set(purchases.map((p) => p.postId))

    const pageHasTopFanPost = pagePosts.some(
        (p) => p.access?.accessLevel === "TOP_FANS_ONLY"
    )
    const viewerIsTopFan =
        pageHasTopFanPost && viewerId && !isOwnProfile
            ? await isTopFan(creatorId, viewerId)
            : false

    const viewerPlanId = subscription?.planId ?? subscription?.subscriptionPlanId ?? null

    return {
        status: "success",
        nextCursor: hasMore ? pagePosts[pagePosts.length - 1].id : null,
        posts: pagePosts.map((post) => {
            const unlocked = resolvePostUnlocked(
                {
                    accessLevel:    post.access?.accessLevel ?? "PUBLIC",
                    allowedPlanIds: post.access?.allowedPlanIds ?? [],
                },
                {
                    isOwnProfile,
                    isPurchased:    purchasedIds.has(post.id),
                    isFollowing,
                    isSubscribed:   !!subscription,
                    viewerPlanId,
                    viewerIsTopFan,
                }
            )
            return {
                id:            post.id,
                type:          post.type,
                thumbnailUrl:  post.thumbnailUrl, // rendered blurred when locked
                previewUrl:    unlocked ? post.mediaUrls[0] ?? null : null, // never leak gated media
                snippet:       unlocked ? (post.title || post.body)?.slice(0, 140) ?? null : null,
                mediaCount:    post.mediaUrls.length,
                videoDuration: post.videoDuration,
                likeCount:     post.likeCount,
                commentCount:  post.commentCount,
                accessLevel:   post.access?.accessLevel ?? "PUBLIC",
                unlocked,
                publishedAt:   post.publishedAt,
            }
        }),
    }
}

// ── Single post for the profile lightbox ──────────────────────────────────────
// Same access resolution as the grid; gated content (mediaUrls, body, title)
// is stripped server-side when locked.

export async function getPostForModalAction(postId: string): Promise<ModalPostResult> {
    if (!postId) return { status: "error", message: "Post id is required." }

    const session  = await auth()
    const viewerId = session?.user?.id ?? null

    const post = await prisma.post.findFirst({
        where: { id: postId, status: "PUBLISHED" },
        select: {
            id:            true,
            creatorId:     true,
            type:          true,
            title:         true,
            body:          true,
            thumbnailUrl:  true,
            mediaUrls:     true,
            videoDuration: true,
            likeCount:     true,
            commentCount:  true,
            publishedAt:   true,
            access:        { select: { accessLevel: true, allowedPlanIds: true } },
            creator:       { select: { userId: true } },
        },
    })
    if (!post) return { status: "not_found" }

    const isOwnProfile = viewerId === post.creator.userId

    const [{ isFollowing, subscription }, purchase] = await Promise.all([
        getViewerContext(post.creatorId, viewerId),
        viewerId
            ? prisma.postPurchase.findUnique({
                where:  { userId_postId: { userId: viewerId, postId: post.id } },
                select: { id: true },
            })
            : Promise.resolve(null),
    ])

    const accessLevel = post.access?.accessLevel ?? "PUBLIC"

    const viewerIsTopFan =
        accessLevel === "TOP_FANS_ONLY" && viewerId && !isOwnProfile
            ? await isTopFan(post.creatorId, viewerId)
            : false

    const unlocked = resolvePostUnlocked(
        {
            accessLevel,
            allowedPlanIds: post.access?.allowedPlanIds ?? [],
        },
        {
            isOwnProfile,
            isPurchased:    !!purchase,
            isFollowing,
            isSubscribed:   !!subscription,
            viewerPlanId:   subscription?.planId ?? subscription?.subscriptionPlanId ?? null,
            viewerIsTopFan,
        }
    )

    return {
        status: "success",
        post: {
            id:            post.id,
            type:          post.type,
            title:         unlocked ? post.title : null,
            body:          unlocked ? post.body  : null,
            mediaUrls:     unlocked ? post.mediaUrls : [],
            thumbnailUrl:  post.thumbnailUrl, // blurred backdrop when locked
            videoDuration: post.videoDuration,
            likeCount:     post.likeCount,
            commentCount:  post.commentCount,
            accessLevel,
            unlocked,
            publishedAt:   post.publishedAt,
        },
    }
}

export async function toggleFollowAction(creatorId: string): Promise<FollowResult> {
    const session = await auth()
    if (!session?.user?.id) return { status: "unauthenticated" }

    const userId = session.user.id

    const creator = await prisma.creator.findUnique({
        where:  { id: creatorId },
        select: {
            id:             true,
            userId:         true,
            followersCount: true,
            user:           { select: { username: true } },
        },
    })
    if (!creator) return { status: "error", message: "Creator not found." }
    if (creator.userId === userId) return { status: "error", message: "You can't follow yourself." }

    const profilePath = `/fan/${creator.user.username}`

    const existing = await prisma.follow.findUnique({
        where: { userId_creatorId: { userId, creatorId } },
    })

    if (existing) {
        const [, updated] = await prisma.$transaction([
            prisma.follow.delete({ where: { id: existing.id } }),
            prisma.creator.update({
                where: { id: creatorId },
                data:  { followersCount: { decrement: 1 } },
            }),
        ])

        revalidatePath(profilePath)
        return { status: "success", following: false, followersCount: updated.followersCount }
    }

    try {
        const [, updated] = await prisma.$transaction([
            prisma.follow.create({ data: { userId, creatorId } }),
            prisma.creator.update({
                where: { id: creatorId },
                data:  { followersCount: { increment: 1 } },
            }),
            prisma.notification.create({
                data: {
                    userId: creator.userId,
                    type:   "NEW_FOLLOWER",
                    title:  "New follower!",
                    body:   "Someone just followed you.",
                    href:   "/creator/audience",
                },
            }),
        ])

        revalidatePath(profilePath)
        return { status: "success", following: true, followersCount: updated.followersCount }
    } catch (err: unknown) {
        if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
            return { status: "success", following: true, followersCount: creator.followersCount }
        }
        return { status: "error", message: "Something went wrong. Please try again." }
    }
}