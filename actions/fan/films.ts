"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { resolveThumbnail } from "@/lib/media"
import { resolvePostAccess, resolveUnlockPrice } from "./feed"

export type Film = {
    id:            string
    title:         string
    synopsis:      string
    mediaUrls:     string[]
    thumbnailUrl:  string | null
    posterUrl:     string | null
    backdropUrl:   string | null
    videoDuration: number | null
    publishedAt:   Date | string
    viewCount:     number
    likeCount:     number
    commentCount:  number
    rating?:       string
    streamBadge?:  string
    genre?:        string
    quality?:      string
    tag?:          string
    isLiked:       boolean
    isSaved:       boolean
    isPurchased:   boolean
    hasAccess:     boolean
    lockReason:    string | null
    unlockPrice:   number | null
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        isVerified:  boolean
        image:       string | null
    }
}

// ── Curated Showcase Fillers ──────────────────────────────────────────────────
// Ensures the Netflix & YouTube layouts are fully fleshed out with stunning media
// even if creators haven't uploaded dozens of 2+ minute videos yet.
const SHOWCASE_FILMS: Film[] = [
    {
        id: "film-showcase-money-heist",
        title: "The Lagos Heist: Masterplan",
        synopsis: "Eight elite hackers and strategists attempt the biggest digital vault takeover in West African history, locked in a battle of wits against cyber defense authorities.",
        mediaUrls: [
            "https://res.cloudinary.com/docaxdijp/video/upload/v1790254802/nesora/posts/videos/ssgrojzt4evocnwyoofb.mp4",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1280&q=80",
        posterUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=80",
        backdropUrl: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920&q=80",
        videoDuration: 6340, // 1h 45m 40s
        publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        viewCount: 142000,
        likeCount: 18500,
        commentCount: 940,
        rating: "8.8/10",
        streamBadge: "2.4M Streams",
        genre: "Crime Thriller",
        quality: "4K Ultra HD",
        tag: "NESORA Original",
        isLiked: false,
        isSaved: false,
        isPurchased: true,
        hasAccess: true,
        lockReason: null,
        unlockPrice: null,
        creator: {
            id: "creator-showcase-1",
            displayName: "Cinematic Visionaries",
            handle: "cinematicvision",
            isVerified: true,
            image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80",
        },
    },
    {
        id: "film-showcase-billionaire",
        title: "From ₦6,400 to ₦1.2 Billion: The Rise of an African Mogul",
        synopsis: "An in-depth documentary chronicling the groundbreaking journey of self-made founders redefining technology, media, and commerce across the continent.",
        mediaUrls: [
            "https://res.cloudinary.com/docaxdijp/video/upload/v1790253493/nesora/posts/videos/q7iypnpsmjk0ancic5dg.mp4",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1280&q=80",
        posterUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80",
        backdropUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80",
        videoDuration: 3951, // 1:05:51
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        viewCount: 20400,
        likeCount: 3100,
        commentCount: 215,
        rating: "9.2/10",
        streamBadge: "450K Streams",
        genre: "Documentary",
        quality: "1080p HD",
        tag: "Dubbed",
        isLiked: false,
        isSaved: false,
        isPurchased: true,
        hasAccess: true,
        lockReason: null,
        unlockPrice: null,
        creator: {
            id: "creator-showcase-2",
            displayName: "MostBooked Media",
            handle: "mostbooked",
            isVerified: true,
            image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80",
        },
    },
    {
        id: "film-showcase-dollhouse",
        title: "Barbie Vs Bratz Build Amazing Doll House Challenge!",
        synopsis: "A full one-hour creative showdown with miniature interior design, hand-crafted architectural details, and full room renovations.",
        mediaUrls: [
            "https://res.cloudinary.com/docaxdijp/video/upload/v1790275376/nesora/posts/videos/hxeznxilgy1mwzscslhr.mp4",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1280&q=80",
        posterUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&q=80",
        backdropUrl: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1920&q=80",
        videoDuration: 2807, // 46:47
        publishedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        viewCount: 7700,
        likeCount: 980,
        commentCount: 64,
        rating: "8.5/10",
        streamBadge: "120K Streams",
        genre: "Entertainment",
        quality: "1080p HD",
        tag: "Family",
        isLiked: false,
        isSaved: false,
        isPurchased: true,
        hasAccess: true,
        lockReason: null,
        unlockPrice: null,
        creator: {
            id: "creator-showcase-3",
            displayName: "Baby Doll Indo",
            handle: "babydollindo",
            isVerified: true,
            image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80",
        },
    },
    {
        id: "film-showcase-afrobeats",
        title: "Rhythm of the Soil: The Story of Afrobeats",
        synopsis: "How a genre originating in West African streets conquered global stadiums, billboard charts, and revolutionized modern pop culture.",
        mediaUrls: [
            "https://res.cloudinary.com/docaxdijp/video/upload/v1790254802/nesora/posts/videos/ssgrojzt4evocnwyoofb.mp4",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1280&q=80",
        posterUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&q=80",
        backdropUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1920&q=80",
        videoDuration: 5210, // 1h 26m
        publishedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
        viewCount: 98400,
        likeCount: 14200,
        commentCount: 812,
        rating: "9.5/10",
        streamBadge: "1.8M Streams",
        genre: "Music Doc",
        quality: "4K Ultra HD",
        tag: "Trending",
        isLiked: false,
        isSaved: false,
        isPurchased: true,
        hasAccess: true,
        lockReason: null,
        unlockPrice: null,
        creator: {
            id: "creator-showcase-4",
            displayName: "Soundstage Africa",
            handle: "soundstageafrica",
            isVerified: true,
            image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80",
        },
    },
    {
        id: "film-showcase-neon-noir",
        title: "Midnight in Victoria Island",
        synopsis: "A private investigator gets pulled into the secrets of elite high-rises, crypto syndicates, and late-night nightlife intrigues.",
        mediaUrls: [
            "https://res.cloudinary.com/docaxdijp/video/upload/v1790256408/nesora/posts/videos/fgj4s06jwvsv5cqamqwl.mov",
        ],
        thumbnailUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1280&q=80",
        posterUrl: "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&q=80",
        backdropUrl: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&q=80",
        videoDuration: 4180, // 1h 09m
        publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        viewCount: 41500,
        likeCount: 6200,
        commentCount: 390,
        rating: "8.7/10",
        streamBadge: "890K Streams",
        genre: "Mystery / Thriller",
        quality: "4K Ultra HD",
        tag: "Exclusive",
        isLiked: false,
        isSaved: false,
        isPurchased: true,
        hasAccess: true,
        lockReason: null,
        unlockPrice: null,
        creator: {
            id: "creator-showcase-5",
            displayName: "Blacklight Studios",
            handle: "blacklight",
            isVerified: true,
            image: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&q=80",
        },
    },
]

export async function getFilmsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    // Fetch database videos too long to be a short (duration > 120s or duration is null)
    const dbPosts = await prisma.post.findMany({
        where: {
            status: "PUBLISHED",
            type:   "VIDEO",
            OR: [
                { videoDuration: { gt: 120 } },
                { videoDuration: null },
            ],
        },
        orderBy: { publishedAt: "desc" },
        take: 30,
        include: {
            creator: {
                select: {
                    id:          true,
                    displayName: true,
                    handle:      true,
                    isVerified:  true,
                    user:        { select: { image: true } },
                },
            },
            access:        true,
            likes:         { where: { userId }, select: { id: true } },
            postSaves:     { where: { userId }, select: { id: true } },
            postPurchases: { where: { userId }, select: { id: true } },
            _count:        { select: { likes: true, comments: true } },
        },
    })

    const dbFilms: Film[] = await Promise.all(
        dbPosts.map(async (post) => {
            const accessLevel      = post.access?.accessLevel    ?? "PUBLIC"
            const allowedPlanIds   = post.access?.allowedPlanIds ?? []
            const alreadyPurchased = post.postPurchases.length > 0

            const { hasAccess, lockReason } = alreadyPurchased
                ? { hasAccess: true, lockReason: null }
                : await resolvePostAccess({
                    userId,
                    creatorId: post.creatorId,
                    accessLevel,
                    allowedPlanIds,
                })

            const unlockPrice = (!hasAccess && lockReason)
                ? await resolveUnlockPrice({
                    creatorId: post.creatorId,
                    accessLevel,
                    allowedPlanIds,
                })
                : null

            const thumb = resolveThumbnail(post.thumbnailUrl, post.mediaUrls[0])

            return {
                id:            post.id,
                title:         post.title || "Untitled Film",
                synopsis:      post.body || "A captivating long-form visual experience created exclusively for NESORA fans.",
                mediaUrls:     hasAccess ? post.mediaUrls : [],
                thumbnailUrl:  thumb,
                posterUrl:     thumb,
                backdropUrl:   thumb,
                videoDuration: post.videoDuration ?? 180,
                publishedAt:   post.publishedAt ?? post.createdAt,
                viewCount:     post.viewCount,
                likeCount:     post._count.likes,
                commentCount:  post._count.comments,
                rating:        "8.9/10",
                streamBadge:   `${Math.max(post.viewCount, 1200).toLocaleString()} Views`,
                genre:         "Creator Series",
                quality:       "1080p HD",
                tag:           "Original",
                isLiked:       post.likes.length > 0,
                isSaved:       post.postSaves.length > 0,
                isPurchased:   alreadyPurchased,
                hasAccess,
                lockReason,
                unlockPrice,
                creator: {
                    id:          post.creator.id,
                    displayName: post.creator.displayName,
                    handle:      post.creator.handle,
                    isVerified:  post.creator.isVerified,
                    image:       post.creator.user.image,
                },
            }
        })
    )

    // Merge database films with showcase fillers for a rich catalog
    const allFilms = [...dbFilms, ...SHOWCASE_FILMS]

    const heroFilm      = allFilms[0] ?? SHOWCASE_FILMS[0]
    const newThisWeek   = allFilms.slice(0, 8)
    const trendingNow   = [...allFilms].sort((a, b) => b.viewCount - a.viewCount)
    const creatorFilms  = allFilms.filter((f) => f.hasAccess)

    return {
        films:        allFilms,
        heroFilm,
        newThisWeek,
        trendingNow,
        creatorFilms,
    }
}

export async function getFilmByIdAction(id: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const userId = session.user.id

    // Check showcase first if ID matches
    const showcaseMatch = SHOWCASE_FILMS.find((s) => s.id === id)
    if (showcaseMatch) return showcaseMatch

    const post = await prisma.post.findUnique({
        where: { id },
        include: {
            creator: {
                select: {
                    id:          true,
                    displayName: true,
                    handle:      true,
                    isVerified:  true,
                    user:        { select: { image: true } },
                },
            },
            access:        true,
            likes:         { where: { userId }, select: { id: true } },
            postSaves:     { where: { userId }, select: { id: true } },
            postPurchases: { where: { userId }, select: { id: true } },
            _count:        { select: { likes: true, comments: true } },
        },
    })

    if (!post) return null

    const accessLevel      = post.access?.accessLevel    ?? "PUBLIC"
    const allowedPlanIds   = post.access?.allowedPlanIds ?? []
    const alreadyPurchased = post.postPurchases.length > 0

    const { hasAccess, lockReason } = alreadyPurchased
        ? { hasAccess: true, lockReason: null }
        : await resolvePostAccess({
            userId,
            creatorId: post.creatorId,
            accessLevel,
            allowedPlanIds,
        })

    const unlockPrice = (!hasAccess && lockReason)
        ? await resolveUnlockPrice({
            creatorId: post.creatorId,
            accessLevel,
            allowedPlanIds,
        })
        : null

    const thumb = resolveThumbnail(post.thumbnailUrl, post.mediaUrls[0])

    return {
        id:            post.id,
        title:         post.title || "Untitled Film",
        synopsis:      post.body || "A captivating long-form visual experience created exclusively for NESORA fans.",
        mediaUrls:     hasAccess ? post.mediaUrls : [],
        thumbnailUrl:  thumb,
        posterUrl:     thumb,
        backdropUrl:   thumb,
        videoDuration: post.videoDuration ?? 180,
        publishedAt:   post.publishedAt ?? post.createdAt,
        viewCount:     post.viewCount,
        likeCount:     post._count.likes,
        commentCount:  post._count.comments,
        rating:        "8.9/10",
        streamBadge:   `${post.viewCount.toLocaleString()} Views`,
        genre:         "Creator Series",
        quality:       "1080p HD",
        tag:           "Original",
        isLiked:       post.likes.length > 0,
        isSaved:       post.postSaves.length > 0,
        isPurchased:   alreadyPurchased,
        hasAccess,
        lockReason,
        unlockPrice,
        creator: {
            id:          post.creator.id,
            displayName: post.creator.displayName,
            handle:      post.creator.handle,
            isVerified:  post.creator.isVerified,
            image:       post.creator.user.image,
        },
    } as Film
}
