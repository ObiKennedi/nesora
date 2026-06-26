// app/(fan)/feed/page.tsx
import { Suspense }        from "react"
import { auth }            from "@/lib/auth"
import { redirect }        from "next/navigation"
import { prisma }          from "@/lib/prisma"
import { getFeedAction }   from "@/actions/fan/feed"
import { FeedClient }      from "@/component/fan/feed/FeedClient"
import { Loader }          from "@/component/essentials/Loader"

export default async function FeedPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // Initial feed data + live streams in parallel
    const [feedData, liveStreams, fanInterests] = await Promise.all([
        getFeedAction({ page: 1 }),

        // Fetch live streams from creators the fan follows
        prisma.liveStream.findMany({
            where: {
                status: "LIVE",
                creator: {
                    followers: { some: { userId: session.user.id } },
                },
            },
            select: {
                id:    true,
                title: true,
                creator: {
                    select: {
                        id:          true,
                        displayName: true,
                        handle:      true,
                        user:        { select: { image: true } },
                    },
                },
            },
            take: 10,
        }),

        // Fan's category interests for chips
        prisma.userCategoryInterest.findMany({
            where:  { userId: session.user.id },
            select: { category: true },
        }),
    ])

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading your feed…" />}>
            <FeedClient
                initialPosts={feedData.posts}
                initialShorts={[]}
                liveStreams={liveStreams}
                fanCategories={fanInterests.map((i) => i.category)}
            />
        </Suspense>
    )
}