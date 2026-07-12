"use server"

import { auth }   from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z }      from "zod"
import {
    buildFullPost,
    type FullPost,
    type PostCreatorSummary,
} from "@/lib/post-access"

export type PostPageResult =
    | { status: "not_found" }
    | {
        status:  "success"
        post:    FullPost
        creator: PostCreatorSummary
        viewer:  { authenticated: boolean }
    }

export type NextPostResult =
    | { status: "end" }
    | { status: "error"; message: string }
    | { status: "success"; post: FullPost }

// ── Initial page payload ──────────────────────────────────────────────────────

export async function getPostPageAction(postId: string): Promise<PostPageResult> {
    if (!postId) return { status: "not_found" }

    const session  = await auth()
    const viewerId = session?.user?.id ?? null

    const built = await buildFullPost(postId, viewerId)
    if (!built) return { status: "not_found" }

    return {
        status:  "success",
        post:    built.post,
        creator: built.creator,
        viewer:  { authenticated: !!viewerId },
    }
}

const NextSchema = z.object({
    creatorId:   z.string().min(1),
    afterPostId: z.string().min(1),
})

export async function getNextCreatorPostAction(
    data: z.infer<typeof NextSchema>
): Promise<NextPostResult> {
    const parsed = NextSchema.safeParse(data)
    if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message }

    const { creatorId, afterPostId } = parsed.data

    const session  = await auth()
    const viewerId = session?.user?.id ?? null

    const next = await prisma.post.findMany({
        where:   { creatorId, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        cursor:  { id: afterPostId },
        skip:    1,
        take:    1,
        select:  { id: true },
    })

    if (next.length === 0) return { status: "end" }

    const built = await buildFullPost(next[0].id, viewerId)
    if (!built) return { status: "end" }

    return { status: "success", post: built.post }
}