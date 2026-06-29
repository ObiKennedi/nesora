import { prisma } from "@/lib/prisma"

const profileInclude = {
    user:              { select: { image: true, firstName: true, lastName: true } },
    creatorCategories: { select: { category: true } },
    _count:            { select: { posts: true } },
} as const

export async function getPublicCreatorProfile(handleOrId: string) {
    const creator =
        (await prisma.creator.findUnique({ where: { handle: handleOrId }, include: profileInclude })) ??
        (await prisma.creator.findUnique({ where: { id: handleOrId },     include: profileInclude }))

    if (!creator) return null

    const posts = await prisma.post.findMany({
        where: {
            creatorId: creator.id,
            status:    "PUBLISHED",
        },
        orderBy: [
            { publishedAt: "desc" },   // primary: when it went live
            { createdAt:   "desc" },   // fallback for rows with null publishedAt
        ],
        take: 30,
        select: {
            id:           true,
            type:         true,
            title:        true,
            body:         true,
            mediaUrls:    true,
            thumbnailUrl: true,
            publishedAt:  true,
            createdAt:    true,
            viewCount:    true,
            likeCount:    true,
            commentCount: true,
            access:       { select: { accessLevel: true } },
        },
    })

    return {
        id:                  creator.id,
        // …all the existing fields unchanged…
        displayName:         creator.displayName,
        handle:              creator.handle,
        bio:                 creator.bio,
        isVerified:          creator.isVerified,
        image:               creator.user.image,
        bannerImage:         creator.bannerImage,
        accentColor:         creator.accentColor,
        profileTheme:        creator.profileTheme.toLowerCase(),
        websiteUrl:          creator.websiteUrl,
        instagramUrl:        creator.instagramUrl,
        twitterUrl:          creator.twitterUrl,
        tiktokUrl:           creator.tiktokUrl,
        youtubeUrl:          creator.youtubeUrl,
        subscriptionEnabled: creator.subscriptionEnabled,
        subscriptionPrice:   creator.subscriptionPrice ? Number(creator.subscriptionPrice) : null,
        categories:          creator.creatorCategories.map((c) => c.category),
        counts: {
            followers:   creator.followersCount,
            subscribers: creator.subscribersCount,
            posts:       creator._count.posts,
        },

        // ── NEW ──
        posts: posts.map((p) => {
            const locked = (p.access?.accessLevel ?? "PUBLIC") !== "PUBLIC"
            return {
                id:           p.id,
                type:         p.type,
                title:        p.title,
                locked,
                // never serialize body/media for a gated post
                body:         locked ? null : p.body,
                thumbnailUrl: locked ? null : (p.thumbnailUrl ?? p.mediaUrls[0] ?? null),
                date:         (p.publishedAt ?? p.createdAt).toISOString(),
                likeCount:    p.likeCount,
                commentCount: p.commentCount,
            }
        }),
    }
}