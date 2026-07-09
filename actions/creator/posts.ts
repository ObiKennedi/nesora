"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z } from "zod"
import {
    PostType,
    PostStatus,
    PostVisibility,
    PostAccessLevel,
} from "@prisma/client"

const PollSchema = z.object({
    question:  z.string().min(1, "Poll question is required"),
    options:   z.array(z.string().min(1)).min(2, "At least 2 options required").max(6),
    expiresAt: z.string().optional(),
})

const AccessSchema = z.object({
    accessLevel:    z.nativeEnum(PostAccessLevel).default("PUBLIC"),
    allowedPlanIds: z.array(z.string()).default([]),
})

const BasePostSchema = z.object({
    title:         z.string().max(100).optional(),
    type:          z.nativeEnum(PostType),
    visibility:    z.nativeEnum(PostVisibility).default("PUBLIC"),
    body:          z.string().optional(),
    mediaUrls:     z.array(z.string()).default([]),
    thumbnailUrl:  z.string().optional().nullable(),
    videoDuration: z.number().optional(),
    scheduledAt:   z.string().optional(),
    access:        AccessSchema.optional().default({
        accessLevel: "PUBLIC" as const,
        allowedPlanIds: [],
    }),
})

const CreatePostSchema = BasePostSchema.extend({
    status: z.nativeEnum(PostStatus).default("PUBLISHED"),
    poll:   PollSchema.optional(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) throw new Error("Creator profile not found")
    return creator
}

// ── Create Post ───────────────────────────────────────────────────────────────

export async function createPostAction(formData: z.infer<typeof CreatePostSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = CreatePostSchema.safeParse(formData)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)
    const data = parsed.data

    // Content validation
    if (data.type === "TEXT" && !data.body?.trim()) {
        return { error: "Text posts require content." }
    }
    if (["PHOTO", "VIDEO", "AUDIO"].includes(data.type) && data.mediaUrls.length === 0) {
        return { error: "Please upload at least one media file." }
    }
    if (data.type === "POLL" && !data.poll) {
        return { error: "Poll posts require poll data." }
    }

    const status = data.scheduledAt ? "SCHEDULED" : data.status

    const post = await prisma.post.create({
        data: {
            creatorId:    creator.id,
            title:        data.title ?? "",
            type:         data.type,
            status,
            visibility:   data.visibility,
            body:         data.body ?? null,
            mediaUrls:    data.mediaUrls,
            thumbnailUrl: data.thumbnailUrl ?? null,
            videoDuration: data.videoDuration ?? null,
            scheduledAt:  data.scheduledAt ? new Date(data.scheduledAt) : null,
            publishedAt:  status === "PUBLISHED" ? new Date() : null,


            access: {
                create: {
                    accessLevel:    data.access?.accessLevel ?? "PUBLIC",
                    allowedPlanIds: data.access?.allowedPlanIds ?? [],
                },
            },

            ...(data.type === "POLL" && data.poll ? {
                poll: {
                    create: {
                        question: data.poll.question,
                        expiresAt: data.poll.expiresAt ? new Date(data.poll.expiresAt) : null,
                        options: { create: data.poll.options.map(text => ({ text })) },
                    },
                },
            } : {}),
        },
        include: {
            poll: true,
            access: true,
        },
    })

    return { success: true, postId: post.id }
}

// ── Update Post ───────────────────────────────────────────────────────────────

export async function updatePostAction(
    postId: string,
    formData: Partial<z.infer<typeof CreatePostSchema>>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const existing = await prisma.post.findFirst({
        where: { id: postId, creatorId: creator.id },
    })
    if (!existing) return { error: "Post not found." }

    await prisma.$transaction(async (tx) => {
        await tx.post.update({
            where: { id: postId },
            data: {
                title:        formData.title ?? undefined,
                body:         formData.body ?? undefined,
                visibility:   formData.visibility,
                mediaUrls:    formData.mediaUrls,
                thumbnailUrl: formData.thumbnailUrl ?? undefined,
                scheduledAt:  formData.scheduledAt ? new Date(formData.scheduledAt) : undefined,
                updatedAt:    new Date(),
            },
        })

        if (formData.access) {
            await tx.postAccess.upsert({
                where: { postId },
                update: {
                    accessLevel:    formData.access.accessLevel,
                    allowedPlanIds: formData.access.allowedPlanIds,
                },
                create: {
                    postId,
                    accessLevel:    formData.access.accessLevel,
                    allowedPlanIds: formData.access.allowedPlanIds,
                },
            })
        }
    })

    return { success: true }
}

// ── Delete Post ───────────────────────────────────────────────────────────────

export async function deletePostAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const post = await prisma.post.findFirst({
        where: { id: postId, creatorId: creator.id },
    })
    if (!post) return { error: "Post not found." }

    await prisma.post.delete({ where: { id: postId } })

    return { success: true }
}

// ── Get Creator Posts ─────────────────────────────────────────────────────────

export async function getCreatorPostsAction(params?: {
    status?: PostStatus
    type?:   PostType
    page?:   number
    limit?:  number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 10
    const skip  = (page - 1) * limit

    const where = {
        creatorId: creator.id,
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.type   ? { type:   params.type }   : {}),
    }

    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                poll:   { include: { options: true } },
                access: true,
            },
        }),
        prisma.post.count({ where }),
    ])

    return {
        posts,
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

// ── Publish Draft ─────────────────────────────────────────────────────────────

export async function publishDraftAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const post = await prisma.post.findFirst({
        where: { id: postId, creatorId: creator.id, status: "DRAFT" },
    })
    if (!post) return { error: "Draft not found." }

    await prisma.post.update({
        where: { id: postId },
        data: { status: "PUBLISHED", publishedAt: new Date() },
    })

    return { success: true }
}

// ── Reschedule Post ───────────────────────────────────────────────────────────

export async function reschedulePostAction(postId: string, scheduledAt: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = z.string().datetime().safeParse(scheduledAt)
    if (!parsed.success) return { error: "Invalid date." }

    if (new Date(scheduledAt) <= new Date()) {
        return { error: "Scheduled time must be in the future." }
    }

    const creator = await getCreatorOrThrow(session.user.id)

    const post = await prisma.post.findFirst({
        where: { id: postId, creatorId: creator.id, status: "SCHEDULED" },
    })
    if (!post) return { error: "Scheduled post not found." }

    await prisma.post.update({
        where: { id: postId },
        data: { scheduledAt: new Date(scheduledAt) },
    })

    return { success: true }
}

// ── Cancel Schedule ───────────────────────────────────────────────────────────

export async function cancelScheduleAction(postId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const post = await prisma.post.findFirst({
        where: { id: postId, creatorId: creator.id, status: "SCHEDULED" },
    })
    if (!post) return { error: "Scheduled post not found." }

    await prisma.post.update({
        where: { id: postId },
        data: {
            status:      "DRAFT",
            scheduledAt: null,
        },
    })

    return { success: true }
}

// ── Check Post Access (Fan Side) ──────────────────────────────────────────────

export async function checkPostAccessAction(postId: string, viewerUserId: string) {
    const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
            access:  true,
            creator: { select: { id: true } },
        },
    })

    if (!post?.access) return { hasAccess: true }

    const { accessLevel, allowedPlanIds } = post.access
    const creatorId = post.creator.id

    switch (accessLevel) {
        case "PUBLIC":
            return { hasAccess: true }

        case "FOLLOWERS_ONLY": {
            const follow = await prisma.follow.findFirst({
                where: { userId: viewerUserId, creatorId },
            })
            return { hasAccess: !!follow }
        }

        case "SUBSCRIBERS_ONLY": {
            const sub = await prisma.subscription.findFirst({
                where: { userId: viewerUserId, creatorId, status: "ACTIVE" },
            })
            return { hasAccess: !!sub }
        }

        case "PLAN_SPECIFIC": {
            const sub = await prisma.subscription.findFirst({
                where: {
                    userId:    viewerUserId,
                    creatorId,
                    status:    "ACTIVE",
                    planId:    { in: allowedPlanIds },
                },
            })
            return { hasAccess: !!sub }
        }

        case "TOP_FANS_ONLY": {
            const topFans = await prisma.giftTransaction.groupBy({
                by:      ["senderId"],
                where:   { creatorId },
                _sum:    { amount: true },
                orderBy: { _sum: { amount: "desc" } },
                take:    50,
            })
            return { hasAccess: topFans.some((f) => f.senderId === viewerUserId) }
        }

        default:
            return { hasAccess: false }
    }
}