// lib/cron.ts
import cron from "node-cron"
import { prisma } from "@/lib/prisma"

export function startCronJobs() {

    // Runs every minute
    cron.schedule("* * * * *", async () => {
        try {
            await publishScheduledPosts()
        } catch (err) {
            console.error("[cron] publishScheduledPosts failed:", err)
        }
    })

    console.log("[cron] Jobs started")
}

async function publishScheduledPosts() {
    const now = new Date()

    const duePosts = await prisma.post.findMany({
        where: {
            status: "SCHEDULED",
            scheduledAt: { lte: now },
        },
        select: {
            id: true,
            type: true,
            creator: {
                select: {
                    id: true,
                    userId: true,
                    displayName: true,
                    followersCount: true,
                },
            },
        },
    })

    if (duePosts.length === 0) return

    await Promise.allSettled(
        duePosts.map(async (post) => {
            await prisma.post.update({
                where: { id: post.id },
                data: { status: "PUBLISHED", publishedAt: now },
            })

            await prisma.notification.create({
                data: {
                    userId: post.creator.userId,
                    type: "SYSTEM",
                    title: "Your scheduled post is live 🎉",
                    body: `Your ${post.type.toLowerCase()} post has been published automatically.`,
                    href: "/creator/content/feed",
                },
            })

            if (post.creator.followersCount > 0) {
                const followers = await prisma.follow.findMany({
                    where: { creatorId: post.creator.id },
                    select: { userId: true },
                    take: 500,
                })

                if (followers.length > 0) {
                    await prisma.notification.createMany({
                        data: followers.map((f) => ({
                            userId: f.userId,
                            type: "NEW_FOLLOWER" as const,
                            title: `${post.creator.displayName} just posted`,
                            body: `New ${post.type.toLowerCase()} is now live.`,
                            href: `/creator/${post.creator.id}`,
                        })),
                        skipDuplicates: true,
                    })
                }
            }
        })
    )
}