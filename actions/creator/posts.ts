// actions/creator/posts.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z } from "zod"
import {
    PostType, PostStatus,
    PostVisibility,
} from "@prisma/client"

// ── Schemas ───────────────────────────────────────────────────────────────────

const BasePostSchema = z.object({
    type: z.nativeEnum(PostType),
    visibility: z.nativeEnum(PostVisibility).default("PUBLIC"),
    body: z.string().optional(),
    mediaUrls: z.array(z.string()).default([]),
    thumbnailUrl: z.string().optional(),
    scheduledAt: z.string().optional(), // ISO string
})

const PollSchema = z.object({
    question: z.string().min(1, "Poll question is required"),
    options: z.array(z.string().min(1)).min(2, "At least 2 options required").max(6),
    expiresAt: z.string().optional(),
})

const CreatePostSchema = BasePostSchema.extend({
    status: z.nativeEnum(PostStatus).default("PUBLISHED"),
    poll: PollSchema.optional(),
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({
        where: { userId },
    })
    if (!creator) throw new Error("Creator profile not found")
    return creator
}

// ── Create post ───────────────────────────────────────────────────────────────

export async function createPostAction(
    formData: z.infer<typeof CreatePostSchema>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = CreatePostSchema.safeParse(formData)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await getCreatorOrThrow(session.user.id)
    const data = parsed.data

    // Validate content based on type
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
            creatorId: creator.id,
            type: data.type,
            status,
            visibility: data.visibility,
            body: data.body,
            mediaUrls: data.mediaUrls,
            thumbnailUrl: data.thumbnailUrl,
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
            publishedAt: status === "PUBLISHED" ? new Date() : null,

            // Create poll if applicable
            ...(data.type === "POLL" && data.poll ? {
                poll: {
                    create: {
                        question: data.poll.question,
                        expiresAt: data.poll.expiresAt
                            ? new Date(data.poll.expiresAt)
                            : null,
                        options: {
                            create: data.poll.options.map((text) => ({ text })),
                        },
                    },
                },
            } : {}),
        },
    })

    return { success: true, postId: post.id }
}

// ── Update post ───────────────────────────────────────────────────────────────

export async function updatePostAction(
    postId: string,
    formData: Partial<z.infer<typeof CreatePostSchema>>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    // Verify ownership
    const existing = await prisma.post.findFirst({
        where: { id: postId, creatorId: creator.id },
    })
    if (!existing) return { error: "Post not found." }

    await prisma.post.update({
        where: { id: postId },
        data: {
            body: formData.body,
            visibility: formData.visibility,
            mediaUrls: formData.mediaUrls,
            thumbnailUrl: formData.thumbnailUrl,
            scheduledAt: formData.scheduledAt
                ? new Date(formData.scheduledAt)
                : undefined,
            updatedAt: new Date(),
        },
    })

    return { success: true }
}

// ── Delete post ───────────────────────────────────────────────────────────────

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

// ── Get posts (feed) ──────────────────────────────────────────────────────────

export async function getCreatorPostsAction(params?: {
    status?: PostStatus
    type?: PostType
    page?: number
    limit?: number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const skip = (page - 1) * limit

    const [posts, total] = await Promise.all([
        prisma.post.findMany({
            where: {
                creatorId: creator.id,
                ...(params?.status ? { status: params.status } : {}),
                ...(params?.type ? { type: params.type } : {}),
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                poll: {
                    include: { options: true },
                },
            },
        }),
        prisma.post.count({
            where: {
                creatorId: creator.id,
                ...(params?.status ? { status: params.status } : {}),
                ...(params?.type ? { type: params.type } : {}),
            },
        }),
    ])

    return {
        posts,
        total,
        pages: Math.ceil(total / limit),
        page,
    }
}

// ── Publish draft ─────────────────────────────────────────────────────────────

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

// actions/creator/posts.ts — add these two

// ── Reschedule a post ─────────────────────────────────────────────────────────
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

// ── Cancel schedule → revert to draft ────────────────────────────────────────
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
            status: "DRAFT",
            scheduledAt: null,
        },
    })

    return { success: true }
}