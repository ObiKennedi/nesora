// ═══════════════════════════════════════════════════════════════════════════
// app/(fan)/fan/feed/page.tsx
// ═══════════════════════════════════════════════════════════════════════════
import { Suspense }                 from "react"
import { auth }                     from "@/lib/auth"
import { redirect }                 from "next/navigation"
import { prisma }                   from "@/lib/prisma"
import { getFeedAction, getShortsAction } from "@/actions/fan/feed"
import { getDiscoverCreatorsAction }      from "@/actions/fan/discover"
import { FeedClient }               from "@/component/fan/feed/FeedClient"
import { Loader }                   from "@/component/essentials/Loader"

/** Live streams from creators the fan follows. Shared by /feed and /live. */
export async function getFollowedLiveStreams(userId: string) {
    return prisma.liveStream.findMany({
        where: {
            status:  "LIVE",
            creator: { followers: { some: { userId } } },
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
    })
}

export default async function FeedPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const [feedData, shortsData, liveStreams, fanInterests, discover] = await Promise.all([
        getFeedAction({ page: 1 }),
        getShortsAction({ page: 1, limit: 16 }),
        getFollowedLiveStreams(session.user.id),
        prisma.userCategoryInterest.findMany({
            where:  { userId: session.user.id },
            select: { category: true },
        }),
        getDiscoverCreatorsAction({ category: "ALL", page: 1 }),
    ])

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading your feed…" />}>
            <FeedClient
                initialPosts={feedData.posts}
                initialShorts={shortsData.shorts as any}
                liveStreams={liveStreams}
                fanCategories={fanInterests.map((i) => i.category)}
                currentUserId={session.user.id}
                suggestedCreators={discover.creators
                    .filter((c) => !c.isFollowing)
                    .slice(0, 5)}
            />
        </Suspense>
    )
}