"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"

export async function getStreamForWatchAction(streamId: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    const userId = session.user.id

    const stream = await prisma.liveStream.findUnique({
        where: { id: streamId },
        select: {
            id: true, title: true, description: true, status: true,
            isSubscriberOnly: true, playbackUrl: true, recordingUrl: true, startedAt: true,
            creator: {
                select: {
                    id: true, displayName: true, handle: true, isVerified: true,
                    user: { select: { image: true } },
                    subscriptionPlans: {
                        where: { isActive: true }, orderBy: { price: "asc" }, take: 1,
                        select: { price: true },
                    },
                },
            },
        },
    })
    if (!stream) return { error: "Stream not found." as const }

    const [subscription, follow] = await Promise.all([
        prisma.subscription.findFirst({
            where:  { userId, creatorId: stream.creator.id, status: "ACTIVE" },
            select: { id: true },
        }),
        prisma.follow.findUnique({
            where:  { userId_creatorId: { userId, creatorId: stream.creator.id } },
            select: { id: true },
        }),
    ])

    const isSubscribed = !!subscription
    const locked       = stream.isSubscriberOnly && !isSubscribed
    const cheapest     = stream.creator.subscriptionPlans[0]

    return {
        success: true as const,
        stream: {
            id: stream.id,
            title: stream.title,
            description: stream.description,
            status: stream.status,
            isSubscriberOnly: stream.isSubscriberOnly,
            startedAt: stream.startedAt,
            // Never leak the playback URL to someone who's gated out.
            playbackUrl:  locked ? null : stream.playbackUrl,
            recordingUrl: locked ? null : stream.recordingUrl,
        },
        creator: {
            id: stream.creator.id,
            displayName: stream.creator.displayName,
            handle: stream.creator.handle,
            isVerified: stream.creator.isVerified,
            image: stream.creator.user.image,
        },
        locked,
        isSubscribed,
        isFollowing:    !!follow,
        subscribePrice: cheapest ? Number(cheapest.price) : null,
    }
}