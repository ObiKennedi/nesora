// app/api/cron/publish-scheduled/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {

    // ── Verify this is a legitimate Vercel cron call ──────────────────────────
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()

    // ── Find all scheduled posts whose time has come ──────────────────────────
    const duePosts = await prisma.post.findMany({
        where: {
            status: "SCHEDULED",
            scheduledAt: { lte: now },
        },
        select: {
            id: true,
            scheduledAt: true,
            type: true,
            creator: {
                select: {
                    id: true,
                    displayName: true,
                    userId: true,
                    followersCount: true,
                },
            },
        },
    })

    if (duePosts.length === 0) {
        return NextResponse.json({ published: 0, message: "No posts due" })
    }

    const results = await Promise.allSettled(
        duePosts.map(async (post) => {

            // ── 1. Publish the post ───────────────────────────────────────────
            await prisma.post.update({
                where: { id: post.id },
                data: {
                    status: "PUBLISHED",
                    publishedAt: now,
                },
            })

            // ── 2. Notify the creator ─────────────────────────────────────────
            await prisma.notification.create({
                data: {
                    userId: post.creator.userId,
                    type: "SYSTEM",
                    title: "Your scheduled post is live 🎉",
                    body: `Your ${post.type.toLowerCase()} post has been published automatically.`,
                    href: `/creator/content/feed`,
                },
            })

            // ── 3. Notify followers (batch, max 500 to avoid timeout) ─────────
            // Only notify if creator has followers worth notifying
            if (post.creator.followersCount > 0) {
                const followers = await prisma.follow.findMany({
                    where: { creatorId: post.creator.id },
                    select: { userId: true },
                    take: 500, // cap per run — large audiences need a queue
                })

                if (followers.length > 0) {
                    await prisma.notification.createMany({
                        data: followers.map((f) => ({
                            userId: f.userId,
                            type: "NEW_FOLLOWER" as const, // reuse closest type
                            title: `${post.creator.displayName} just posted`,
                            body: `New ${post.type.toLowerCase()} post is now live.`,
                            href: `/creator/${post.creator.id}`,
                        })),
                        skipDuplicates: true,
                    })
                }
            }

            return post.id
        })
    )

    const published = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected")

    if (failed.length > 0) {
        console.error(
            `[cron] ${failed.length} post(s) failed to publish:`,
            failed.map((r) => (r as PromiseRejectedResult).reason)
        )
    }

    console.log(`[cron] Published: ${published}, Failed: ${failed.length}`)

    return NextResponse.json({
        published,
        failed: failed.length,
        total: duePosts.length,
    })
}