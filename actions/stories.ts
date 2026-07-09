// actions/stories.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redis, redisKeys } from "@/lib/redis"
import { pusherServer } from "@/lib/pusher"
import { cloudinary } from "@/lib/cloudinary-server"
import { redirect } from "next/navigation"
import { z } from "zod"
import { PostAccessLevel, StoryMediaType } from "@prisma/client"

const STORY_TTL_HOURS   = 24
const MAX_VIDEO_SECONDS = 60

// Text card presets — single source of truth, shared with the composer UI
export const TEXT_CARD_BACKGROUNDS = [
    "#c2622a", "#1a1a2e", "#0f3d2e", "#4a1942", "#8c2f39", "#2b4162",
] as const

export const TEXT_CARD_FONTS = ["classic", "bold", "mono"] as const

// ── Schemas ───────────────────────────────────────────────────────────────────

const AccessSchema = z.object({
    accessLevel:    z.nativeEnum(PostAccessLevel).default("PUBLIC"),
    allowedPlanIds: z.array(z.string()).default([]),
})

const MediaStorySchema = z.object({
    mediaType:          z.enum(["PHOTO", "VIDEO"]),
    mediaUrl:           z.string().url(),
    cloudinaryPublicId: z.string().min(1),
    thumbnailUrl:       z.string().url().optional(),
    duration:           z.number().int().positive().max(MAX_VIDEO_SECONDS).optional(),
    caption:            z.string().max(200).optional(),
    access:             AccessSchema.default({ accessLevel: "PUBLIC", allowedPlanIds: [] }),
})

const TextCardStorySchema = z.object({
    mediaType:       z.literal("TEXT_CARD"),
    body:            z.string().trim().min(1, "Story text is required").max(280),
    backgroundColor: z.enum(TEXT_CARD_BACKGROUNDS),
    fontStyle:       z.enum(TEXT_CARD_FONTS).default("classic"),
    access:          AccessSchema.default({ accessLevel: "PUBLIC", allowedPlanIds: [] }),
})

const CreateStorySchema = z.discriminatedUnion("mediaType", [
    MediaStorySchema.extend({ mediaType: z.literal("PHOTO") }),
    MediaStorySchema.extend({ mediaType: z.literal("VIDEO") }),
    TextCardStorySchema,
])

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) throw new Error("Creator profile not found")
    return creator
}

/** Top-fan ID set per creator, cached in Upstash (1h TTL). */
async function getTopFanIds(creatorId: string): Promise<Set<string>> {
    const cacheKey = `topfans:${creatorId}`
    const cached = await redis.get<string[]>(cacheKey)
    if (cached) return new Set(cached)

    const topFans = await prisma.giftTransaction.groupBy({
        by:      ["senderId"],
        where:   { creatorId },
        _sum:    { amount: true },
        orderBy: { _sum: { amount: "desc" } },
        take:    50,
    })
    const ids = topFans.map((f) => f.senderId)
    await redis.set(cacheKey, ids, { ex: 3600 })
    return new Set(ids)
}

type ViewerContext = {
    followedCreatorIds: Set<string>
    // creatorId → planId of the viewer's ACTIVE subscription (null if no plan)
    subscriptionsByCreator: Map<string, string | null>
}

async function getViewerContext(userId: string): Promise<ViewerContext> {
    const [follows, subs] = await Promise.all([
        prisma.follow.findMany({ where: { userId }, select: { creatorId: true } }),
        prisma.subscription.findMany({
            where:  { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
            select: { creatorId: true, planId: true },
        }),
    ])
    return {
        followedCreatorIds:     new Set(follows.map((f) => f.creatorId)),
        subscriptionsByCreator: new Map(subs.map((s) => [s.creatorId, s.planId])),
    }
}

type StoryAccessShape = {
    creatorId:      string
    accessLevel:    PostAccessLevel
    allowedPlanIds: string[]
}

/** Subscribers pass FOLLOWERS_ONLY too — subscription is the stronger relationship. */
async function checkStoryAccess(
    story: StoryAccessShape,
    viewerUserId: string,
    ctx: ViewerContext,
): Promise<boolean> {
    const isFollower   = ctx.followedCreatorIds.has(story.creatorId)
    const isSubscriber = ctx.subscriptionsByCreator.has(story.creatorId)

    switch (story.accessLevel) {
        case "PUBLIC":           return true
        case "FOLLOWERS_ONLY":   return isFollower || isSubscriber
        case "SUBSCRIBERS_ONLY": return isSubscriber
        case "PLAN_SPECIFIC": {
            const planId = ctx.subscriptionsByCreator.get(story.creatorId)
            return !!planId && story.allowedPlanIds.includes(planId)
        }
        case "TOP_FANS_ONLY": {
            const topFans = await getTopFanIds(story.creatorId)
            return topFans.has(viewerUserId)
        }
        default: return false
    }
}

const unexpired = () => ({ expiresAt: { gt: new Date() } })

// ── Create Story ──────────────────────────────────────────────────────────────

export async function createStoryAction(formData: z.infer<typeof CreateStorySchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = CreateStorySchema.safeParse(formData)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)
    const data = parsed.data

    if (data.mediaType === "VIDEO" && !data.duration) {
        return { error: "Video duration could not be determined." }
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + STORY_TTL_HOURS * 60 * 60 * 1000)

    const story = await prisma.story.create({
        data: {
            creatorId: creator.id,
            mediaType: data.mediaType,
            expiresAt,

            ...(data.mediaType === "TEXT_CARD"
                ? {
                    body:            data.body,
                    backgroundColor: data.backgroundColor,
                    fontStyle:       data.fontStyle,
                }
                : {
                    mediaUrl:           data.mediaUrl,
                    cloudinaryPublicId: data.cloudinaryPublicId,
                    thumbnailUrl:       data.thumbnailUrl ?? null,
                    duration:           data.duration ?? null,
                    caption:            data.caption ?? null,
                }),

            accessLevel:    data.access.accessLevel,
            allowedPlanIds: data.access.accessLevel === "PLAN_SPECIFIC"
                ? data.access.allowedPlanIds
                : [],
        },
    })

    return { success: true, storyId: story.id }
}

// ── Creator: My Active Stories (content page row) ─────────────────────────────

export async function getMyStoriesAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    return prisma.story.findMany({
        where:   { creatorId: creator.id, ...unexpired() },
        orderBy: { createdAt: "asc" },
    })
}

// ── Creator: Story Viewers ────────────────────────────────────────────────────

export async function getStoryViewersAction(storyId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const story = await prisma.story.findFirst({
        where: { id: storyId, creatorId: creator.id },
        select: { id: true },
    })
    if (!story) return { error: "Story not found." as const }

    const views = await prisma.storyView.findMany({
        where:   { storyId },
        orderBy: { createdAt: "desc" },
    })

    // StoryView has no User relation in schema — resolve viewers in one query
    const users = await prisma.user.findMany({
        where:  { id: { in: views.map((v) => v.userId) } },
        select: { id: true, name: true, username: true, image: true },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    return {
        viewers: views.map((v) => ({
            viewedAt: v.createdAt,
            user:     userMap.get(v.userId) ?? null,
        })),
    }
}

// ── Creator: Delete Story ─────────────────────────────────────────────────────

export async function deleteStoryAction(storyId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const story = await prisma.story.findFirst({
        where: { id: storyId, creatorId: creator.id },
    })
    if (!story) return { error: "Story not found." }

    // Destroy asset first — if Cloudinary fails we keep the row so the
    // cleanup sweep retries, instead of orphaning the asset forever.
    if (story.cloudinaryPublicId) {
        try {
            await cloudinary.uploader.destroy(story.cloudinaryPublicId, {
                resource_type: story.mediaType === "VIDEO" ? "video" : "image",
            })
        } catch {
            return { error: "Could not remove media. Please try again." }
        }
    }

    await prisma.story.delete({ where: { id: storyId } })
    return { success: true }
}

// ── Fan: Stories Rail ─────────────────────────────────────────────────────────

export async function getStoriesRailAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const ctx = await getViewerContext(userId)
    const creatorIds = [
        ...new Set([...ctx.followedCreatorIds, ...ctx.subscriptionsByCreator.keys()]),
    ]
    if (creatorIds.length === 0) return { rail: [] }

    const creators = await prisma.creator.findMany({
        where: {
            id: { in: creatorIds },
            stories: { some: unexpired() },
        },
        select: {
            id:          true,
            displayName: true,
            handle:      true,
            user:        { select: { image: true } },
            stories: {
                where:   unexpired(),
                orderBy: { createdAt: "asc" },
            },
        },
    })

    // Access-filter every story per viewer (rail sets are small — in-memory is fine)
    const filtered = await Promise.all(
        creators.map(async (c) => {
            const visible = []
            for (const s of c.stories) {
                if (await checkStoryAccess(s, userId, ctx)) visible.push(s)
            }
            return { ...c, stories: visible }
        }),
    )
    const withStories = filtered.filter((c) => c.stories.length > 0)

    // Watched state
    const allStoryIds = withStories.flatMap((c) => c.stories.map((s) => s.id))
    const myViews = await prisma.storyView.findMany({
        where:  { userId, storyId: { in: allStoryIds } },
        select: { storyId: true },
    })
    const viewedIds = new Set(myViews.map((v) => v.storyId))

    const rail = withStories
        .map((c) => ({
            creator: {
                id:          c.id,
                displayName: c.displayName,
                handle:      c.handle,
                image:       c.user.image,
            },
            stories: c.stories.map((s) => ({
                ...s,
                viewed: viewedIds.has(s.id),
            })),
            hasUnwatched: c.stories.some((s) => !viewedIds.has(s.id)),
            latestAt:     c.stories[c.stories.length - 1].createdAt,
        }))
        .sort((a, b) => {
            if (a.hasUnwatched !== b.hasUnwatched) return a.hasUnwatched ? -1 : 1
            return b.latestAt.getTime() - a.latestAt.getTime()
        })

    return { rail }
}

// ── Fan: Record View ──────────────────────────────────────────────────────────

export async function recordStoryViewAction(storyId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const story = await prisma.story.findFirst({
        where: { id: storyId, ...unexpired() },
    })
    if (!story) return { error: "Story unavailable." }

    // Creators viewing their own story don't count
    const ownCreator = await prisma.creator.findUnique({
        where: { userId }, select: { id: true },
    })
    if (ownCreator?.id === story.creatorId) return { success: true }

    try {
        await prisma.$transaction([
            prisma.storyView.create({ data: { storyId, userId } }),
            prisma.story.update({
                where: { id: storyId },
                data:  { viewCount: { increment: 1 } },
            }),
        ])
    } catch {
        // Unique constraint hit — already viewed. Idempotent, no double count.
    }

    return { success: true }
}

// ── Fan: Reply to Story ───────────────────────────────────────────────────────

// ── Fan: Reply to Story ───────────────────────────────────────────────────────

export async function replyToStoryAction(storyId: string, content: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const trimmed = content.trim()
    if (!trimmed) return { error: "Reply cannot be empty." }
    if (trimmed.length > 500) return { error: "Reply is too long." }

    const story = await prisma.story.findFirst({
        where:   { id: storyId, ...unexpired() },
        include: { creator: { select: { id: true, userId: true, displayName: true } } },
    })
    if (!story) return { error: "This story has expired." }
    if (story.creator.userId === userId) return { error: "You can't reply to your own story." }

    const ctx = await getViewerContext(userId)
    const hasAccess = await checkStoryAccess(story, userId, ctx)
    if (!hasAccess) return { error: "You don't have access to this story." }

    const snapshot = {
        storyId:        story.id,
        storyCaption:   story.mediaType === "TEXT_CARD" ? story.body : story.caption,
        storyMediaType: story.mediaType,
    }

    const existing = await prisma.conversation.findFirst({
        where: { creatorId: story.creator.id, subscriberId: userId },
    })
    const isSubscriber = ctx.subscriptionsByCreator.has(story.creator.id)

    // ── Direct message path ───────────────────────────────────────────────────
    if (existing || isSubscriber) {
        const conversation = existing ?? await prisma.conversation.create({
            data: { creatorId: story.creator.id, subscriberId: userId },
        })

        const message = await prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderId:       userId,
                type:           "TEXT",
                content:        trimmed,
                ...snapshot,
            },
            include: {
                sender: {
                    select: {
                        id:        true,
                        username:  true,
                        firstName: true,
                        lastName:  true,
                        image:     true,
                    },
                },
            },
        })

        await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
                lastMessageAt:   message.createdAt,
                lastMessageText: `↩️ Replied to your story: ${trimmed.slice(0, 80)}`,
            },
        })

        const recipientId = story.creator.userId

        await pusherServer.trigger(
            `private-conversation-${conversation.id}`,
            "new-message",
            { message }
        )

        await pusherServer.trigger(
            `private-user-${recipientId}`,
            "new-conversation-message",
            {
                conversationId: conversation.id,
                message: {
                    id:        message.id,
                    type:      message.type,
                    content:   message.content,
                    createdAt: message.createdAt,
                    sender:    message.sender,
                },
            }
        )

        await redis.incr(redisKeys.unreadCount(recipientId, conversation.id))
        await redis.incr(redisKeys.totalUnread(recipientId))

        await prisma.notification.create({
            data: {
                userId: recipientId,
                type:   "NEW_MESSAGE",
                title:  `${message.sender.firstName ?? "Someone"} replied to your story`,
                body:   trimmed.slice(0, 80),
                href:   `/creator/messages/${conversation.id}`,
            },
        })

        // If this reply created the conversation, tell the creator's list to refresh
        if (!existing) {
            await pusherServer.trigger(
                `private-user-${recipientId}`,
                "new-conversation",
                { conversationId: conversation.id }
            )
        }

        return { success: true, delivered: "MESSAGE" as const }
    }

    // ── Message request path (follower, non-subscriber) ──────────────────────
    const pendingRequest = await prisma.messageRequest.findFirst({
        where: {
            fromUserId:  userId,
            toCreatorId: story.creator.id,
            status:      "PENDING",
        },
    })
    if (pendingRequest) {
        return { error: "You already have a pending message request to this creator." }
    }

    const request = await prisma.messageRequest.create({
        data: {
            fromUserId:  userId,
            toCreatorId: story.creator.id,
            message:     `↩️ Replied to your story: "${trimmed}"`,
        },
    })

    await pusherServer.trigger(
        `private-user-${story.creator.userId}`,
        "new-message-request",
        {
            requestId: request.id,
            fromUser: {
                id:        userId,
                firstName: session.user.name?.split(" ")[0] ?? null,
            },
            message: trimmed,
        }
    )

    await prisma.notification.create({
        data: {
            userId: story.creator.userId,
            type:   "NEW_MESSAGE",
            title:  "New message request",
            body:   `Replied to your story: ${trimmed.slice(0, 60)}`,
            href:   "/creator/messages?tab=requests",
        },
    })

    return { success: true, delivered: "REQUEST" as const }
}

// ── Cleanup Sweep (cron) ──────────────────────────────────────────────────────

export async function sweepExpiredStories() {
    const lockKey = "lock:story-sweep"
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 300 })
    if (!locked) return

    try {
        const expired = await prisma.story.findMany({
            where:  { expiresAt: { lt: new Date() } },
            select: { id: true, cloudinaryPublicId: true, mediaType: true },
            take:   200,
        })
        if (expired.length === 0) return

        const images = expired.filter((s) => s.mediaType === "PHOTO" && s.cloudinaryPublicId)
        const videos = expired.filter((s) => s.mediaType === "VIDEO" && s.cloudinaryPublicId)

        // Assets first — a Cloudinary failure keeps rows for the next sweep
        if (images.length) {
            await cloudinary.api.delete_resources(
                images.map((s) => s.cloudinaryPublicId!),
                { resource_type: "image" },
            )
        }
        if (videos.length) {
            await cloudinary.api.delete_resources(
                videos.map((s) => s.cloudinaryPublicId!),
                { resource_type: "video" },
            )
        }

        // Message.storyId nulls via SetNull; snapshots keep reply bubbles intact
        await prisma.story.deleteMany({
            where: { id: { in: expired.map((s) => s.id) } },
        })
    } catch (err) {
        console.error("[story-sweep] failed:", err)
    } finally {
        await redis.del(lockKey)
    }
}