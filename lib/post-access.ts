// lib/post-access.ts
//
// Single source of truth for "can this viewer see this post's content" and for
// building the full gated post payload. Lives outside the actions files because
// "use server" modules can only export async functions — sync helpers and
// shared types have to sit in a plain server-side module. Import this from
// server actions and server components only, never from client components.

import { prisma } from "@/lib/prisma"

const TOP_FAN_LIMIT = 50

export type PostAccessLevel =
    | "PUBLIC"
    | "FOLLOWERS_ONLY"
    | "SUBSCRIBERS_ONLY"
    | "PLAN_SPECIFIC"
    | "TOP_FANS_ONLY"

export type PostType = "TEXT" | "PHOTO" | "VIDEO" | "AUDIO" | "POLL"

export type PostPoll = {
    question:       string | null
    totalVotes:     number
    viewerOptionId: string | null
    options:        { id: string; text: string; votes: number }[]
}

// Full gated payload — used by the profile lightbox AND the post page.
// Gated fields (title, body, mediaUrls, poll) are nulled/emptied when locked.
export type FullPost = {
    id:            string
    type:          PostType
    title:         string | null
    body:          string | null
    mediaUrls:     string[]
    thumbnailUrl:  string | null
    videoDuration: number | null
    likeCount:     number
    commentCount:  number
    accessLevel:   PostAccessLevel
    unlocked:      boolean
    publishedAt:   Date | null
    poll:          PostPoll | null
    viewerLiked:   boolean
    viewerSaved:   boolean
    // ₦ one-time unlock price when locked and individually purchasable
    // (mirrors the derivation in purchasePostAction), else null
    unlockPrice:   number | null
}

export type PostCreatorSummary = {
    id:          string
    userId:      string
    username:    string
    displayName: string
    image:       string | null
    isVerified:  boolean
}

// ── Identifier resolution (username → creator, with id fallback) ──────────────

export async function resolveCreatorIdentifier(identifier: string) {
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

// ── Viewer context ────────────────────────────────────────────────────────────

export async function getViewerContext(creatorId: string, userId: string | null) {
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

export async function isTopFan(creatorId: string, userId: string): Promise<boolean> {
    const topFans = await prisma.giftTransaction.groupBy({
        by:      ["senderId"],
        where:   { creatorId },
        _sum:    { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take:    TOP_FAN_LIMIT,
    })
    return topFans.some((f) => f.senderId === userId)
}

// ── Access resolution ─────────────────────────────────────────────────────────

export type AccessInput = {
    accessLevel:    PostAccessLevel
    allowedPlanIds: string[]
}

export type AccessContext = {
    isOwnProfile:   boolean
    isPurchased:    boolean
    isFollowing:    boolean
    isSubscribed:   boolean
    viewerPlanId:   string | null
    viewerIsTopFan: boolean
}

export function resolvePostUnlocked(access: AccessInput, ctx: AccessContext): boolean {
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

// ── Poll payload ──────────────────────────────────────────────────────────────
// Matches the real schema (Poll → PollOption.voteCount, PollVote.pollOptionId).
// Only called once the post is confirmed unlocked; viewerOptionId comes from
// the session user's own vote lookup — never client-supplied.

async function getPollPayload(postId: string, viewerId: string | null): Promise<PostPoll | null> {
    const post = await prisma.post.findUnique({
        where:  { id: postId },
        select: {
            poll: {
                select: {
                    id:      true,
                    options: { select: { id: true, text: true, voteCount: true } },
                },
            },
        },
    })

    const poll = post?.poll
    if (!poll || poll.options.length === 0) return null

    const viewerVote = viewerId
        ? await prisma.pollVote.findFirst({
            where:  { userId: viewerId, pollOptionId: { in: poll.options.map((o) => o.id) } },
            select: { pollOptionId: true },
        })
        : null

    return {
        // POLL posts carry the question in title/body — rendered separately
        question:       null,
        totalVotes:     poll.options.reduce((sum, o) => sum + o.voteCount, 0),
        viewerOptionId: viewerVote?.pollOptionId ?? null,
        options: poll.options.map((o) => ({
            id:    o.id,
            text:  o.text,
            votes: o.voteCount,
        })),
    }
}

// ── Unlock price derivation ───────────────────────────────────────────────────
// Mirrors purchasePostAction so the displayed price and the charged price can
// never disagree: 10% of the cheapest qualifying active plan.

async function deriveUnlockPrice(
    creatorId:      string,
    accessLevel:    PostAccessLevel,
    allowedPlanIds: string[]
): Promise<number | null> {
    if (accessLevel === "PLAN_SPECIFIC" && allowedPlanIds.length > 0) {
        const plan = await prisma.subscriptionPlan.findFirst({
            where:   { id: { in: allowedPlanIds }, isActive: true },
            orderBy: { price: "asc" },
            select:  { price: true },
        })
        return plan ? Math.round(Number(plan.price) * 0.1) : null
    }

    if (accessLevel === "SUBSCRIBERS_ONLY") {
        const plan = await prisma.subscriptionPlan.findFirst({
            where:   { creatorId, isActive: true },
            orderBy: { price: "asc" },
            select:  { price: true },
        })
        return plan ? Math.round(Number(plan.price) * 0.1) : null
    }

    return null
}

// ── Full post builder ─────────────────────────────────────────────────────────

export async function buildFullPost(
    postId:   string,
    viewerId: string | null
): Promise<{ post: FullPost; creator: PostCreatorSummary } | null> {
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
            creator: {
                select: {
                    id:          true,
                    userId:      true,
                    displayName: true,
                    isVerified:  true,
                    user:        { select: { username: true, image: true } },
                },
            },
        },
    })
    if (!post) return null

    const isOwnProfile = viewerId === post.creator.userId

    const [{ isFollowing, subscription }, purchase, like, save] = await Promise.all([
        getViewerContext(post.creatorId, viewerId),
        viewerId
            ? prisma.postPurchase.findUnique({
                where:  { userId_postId: { userId: viewerId, postId: post.id } },
                select: { id: true },
            })
            : Promise.resolve(null),
        viewerId
            ? prisma.postLike.findUnique({
                where:  { postId_userId: { postId: post.id, userId: viewerId } },
                select: { userId: true },
            })
            : Promise.resolve(null),
        viewerId
            ? prisma.postSave.findUnique({
                where:  { postId_userId: { postId: post.id, userId: viewerId } },
                select: { userId: true },
            })
            : Promise.resolve(null),
    ])

    const accessLevel    = post.access?.accessLevel    ?? "PUBLIC"
    const allowedPlanIds = post.access?.allowedPlanIds ?? []

    const viewerIsTopFan =
        accessLevel === "TOP_FANS_ONLY" && viewerId && !isOwnProfile
            ? await isTopFan(post.creatorId, viewerId)
            : false

    const unlocked = resolvePostUnlocked(
        { accessLevel, allowedPlanIds },
        {
            isOwnProfile,
            isPurchased:    !!purchase,
            isFollowing,
            isSubscribed:   !!subscription,
            viewerPlanId:   subscription?.planId ?? subscription?.subscriptionPlanId ?? null,
            viewerIsTopFan,
        }
    )

    const [poll, unlockPrice] = await Promise.all([
        unlocked && post.type === "POLL"
            ? getPollPayload(post.id, viewerId)
            : Promise.resolve(null),
        !unlocked
            ? deriveUnlockPrice(post.creatorId, accessLevel, allowedPlanIds)
            : Promise.resolve(null),
    ])

    return {
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
            poll,
            viewerLiked:   !!like,
            viewerSaved:   !!save,
            unlockPrice,
        },
        creator: {
            id:          post.creator.id,
            userId:      post.creator.userId,
            username:    post.creator.user.username,
            displayName: post.creator.displayName,
            image:       post.creator.user.image,
            isVerified:  post.creator.isVerified,
        },
    }
}