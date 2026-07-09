// components/fan/feed/FeedClient.tsx
"use client"

import {
    useState,
    useTransition,
    useCallback,
    Fragment,
} from "react"
import { useRouter }            from "next/navigation"
import { Category, PostType }   from "@prisma/client"
import { Loader2 }              from "lucide-react"
import { getFeedAction }        from "@/actions/fan/feed"
import { LiveRail }             from "./LiveRail"
import { FeedTopTabs }          from "./FeedTopTabs"
import { ShortsRail }           from "./ShortsRail"
import { PostCard }             from "./PostCard"
import { CommentPanel }         from "./CommentPanel"
import { GiftPanel }            from "./GiftPanel"
import { FeedRightRail, RailCreator } from "./FeedRightRail"
import { CATEGORIES }           from "@/lib/categories"
import "@/styles/fan/Feed.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type LiveStream = {
    id:    string
    title: string
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
}

type FeedPost = Awaited<ReturnType<typeof getFeedAction>>["posts"][number]

type FeedShort = {
    id:            string
    type:          PostType
    title:         string | null
    thumbnailUrl:  string | null
    videoDuration: number | null
    hasAccess:     boolean
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        image:       string | null
    }
}

type Props = {
    initialPosts:       FeedPost[]
    initialShorts:      FeedShort[]
    liveStreams:        LiveStream[]
    fanCategories:      Category[]
    currentUserId:      string
    suggestedCreators?: RailCreator[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Inject a shorts rail after every N posts. */
const SHORTS_INTERVAL = 5
/** Shorts shown per injected rail. */
const SHORTS_PER_RAIL = 8

// ── FeedClient ────────────────────────────────────────────────────────────────

export const FeedClient = ({
    initialPosts,
    initialShorts,
    liveStreams,
    fanCategories,
    currentUserId,
    suggestedCreators = [],
}: Props) => {
    const router = useRouter()

    // ── Feed pagination ───────────────────────────────────────────────────────
    const [posts,          setPosts]          = useState<FeedPost[]>(initialPosts)
    const [page,           setPage]           = useState(1)
    const [hasMore,        setHasMore]        = useState(initialPosts.length >= 20)
    const [activeCategory, setActiveCategory] = useState<Category | "ALL">("ALL")
    const [loadingMore,    setLoadingMore]    = useState(false)

    // ── Panel state (becomes SidePanel in phase 2) ────────────────────────────
    const [commentPostId, setCommentPostId] = useState<string | null>(null)
    const [giftCreatorId, setGiftCreatorId] = useState<string | null>(null)

    const [, startTransition] = useTransition()

    const liveCreatorIds = new Set(liveStreams.map((s) => s.creator.id))

    // ── Optimistic post update (likes, saves, etc.) ───────────────────────────
    const handlePostUpdate = useCallback((id: string, updates: Partial<FeedPost>) => {
        setPosts((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p))
    }, [])

    // ── Category chip ─────────────────────────────────────────────────────────
    const handleCategoryChange = (cat: Category | "ALL") => {
        setActiveCategory(cat)
        setPage(1)
        setHasMore(true)
        setPosts([])
        startTransition(async () => {
            const data = await getFeedAction({ category: cat, page: 1 })
            setPosts(data.posts)
            setHasMore(data.posts.length >= 20)
        })
    }

    // ── Load more ─────────────────────────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return
        setLoadingMore(true)
        const nextPage = page + 1
        const data     = await getFeedAction({ category: activeCategory, page: nextPage })
        setPosts((prev) => {
            const ids = new Set(prev.map((p) => p.id))
            return [...prev, ...data.posts.filter((p) => !ids.has(p.id))]
        })
        setPage(nextPage)
        setHasMore(data.posts.length >= 20)
        setLoadingMore(false)
    }, [loadingMore, hasMore, page, activeCategory])

    // ── Shorts navigation ─────────────────────────────────────────────────────
    const handleShortClick = (shortId: string) => router.push(`/fan/shorts/${shortId}`)
    const handleSeeAllShorts = ()               => router.push("/fan/shorts")

    // ── Category chips list ───────────────────────────────────────────────────
    const chips = [
        { value: "ALL" as const, label: "All", emoji: "✨" },
        ...CATEGORIES.filter((c) => fanCategories.includes(c.value)),
    ]

    const postsWithLive = posts.map((post) => ({
        ...post,
        creator: { ...post.creator, isLive: liveCreatorIds.has(post.creator.id) },
    }))

    const shortsForBlock = (blockIndex: number): FeedShort[] => {
        if (initialShorts.length === 0) return []
        const offset = (blockIndex * SHORTS_PER_RAIL) % initialShorts.length
        const window: FeedShort[] = []
        for (let i = 0; i < Math.min(SHORTS_PER_RAIL, initialShorts.length); i++) {
            window.push(initialShorts[(offset + i) % initialShorts.length])
        }
        return window
    }

    return (
        <div className="feed-layout">

            {/* ── Main column ─────────────────────────────────────────────── */}
            <div className="feed-main">

                {/* Mobile-only section tabs */}
                <FeedTopTabs liveCount={liveStreams.length} />

                {/* Live rail — stories-style, top of feed */}
                <LiveRail streams={liveStreams} />

                {/* Category chips */}
                <div className="feed-chips">
                    {chips.map((chip) => (
                        <button
                            key={chip.value}
                            type="button"
                            className={`feed-chip ${activeCategory === chip.value ? "feed-chip--active" : ""}`}
                            onClick={() => handleCategoryChange(chip.value)}
                        >
                            <span>{chip.emoji}</span>
                            <span>{chip.label}</span>
                        </button>
                    ))}
                </div>

                {/* Post list, with a shorts rail every SHORTS_INTERVAL posts */}
                <div className="feed-posts">
                    {postsWithLive.length === 0 && (
                        <div className="feed-empty">
                            <p>No posts yet in this category.</p>
                            <p>Follow more creators to fill your feed.</p>
                        </div>
                    )}

                    {postsWithLive.map((post, i) => {
                        const postNumber = i + 1
                        // Rail goes after posts 5, 10, 15… but never trailing the last post
                        const showRail =
                            postNumber % SHORTS_INTERVAL === 0 &&
                            postNumber < postsWithLive.length &&
                            initialShorts.length > 0

                        const blockIndex = postNumber / SHORTS_INTERVAL - 1

                        return (
                            <Fragment key={post.id}>
                                <PostCard
                                    post={post as any}
                                    userId={currentUserId}
                                    onUpdate={handlePostUpdate}
                                    onCommentOpen={(id) => setCommentPostId(id)}
                                    onGiftOpen={(id)    => setGiftCreatorId(id)}
                                />

                                {showRail && (
                                    <ShortsRail
                                        shorts={shortsForBlock(blockIndex)}
                                        onShortClick={handleShortClick}
                                        onSeeAll={handleSeeAllShorts}
                                    />
                                )}
                            </Fragment>
                        )
                    })}

                    {hasMore && (
                        <div className="feed-load-more">
                            <button
                                type="button"
                                className="feed-load-more__btn"
                                onClick={loadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore
                                    ? <><Loader2 size={16} className="spin" /> Loading…</>
                                    : "Load more"
                                }
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right rail  ── */}
            <FeedRightRail suggested={suggestedCreators} />

            {/* ── Comments / gift (become SidePanel in phase 2) ───────────── */}
            {commentPostId && (
                <CommentPanel
                    postId={commentPostId}
                    currentUserId={currentUserId}
                    onClose={() => setCommentPostId(null)}
                    onCommentAdded={() => {
                        handlePostUpdate(commentPostId, {
                            commentCount: (posts.find((p) => p.id === commentPostId)?.commentCount ?? 0) + 1,
                        })
                    }}
                />
            )}

            {giftCreatorId && (
                <GiftPanel
                    creatorId={giftCreatorId}
                    onClose={() => setGiftCreatorId(null)}
                    onSent={()  => setGiftCreatorId(null)}
                />
            )}

        </div>
    )
}