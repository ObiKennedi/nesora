// components/fan/feed/FeedClient.tsx
"use client"

import {
    useState, 
    useTransition, 
    useCallback, 
    useEffect
} from "react"
import {
    useRouter,
    useSearchParams
} from "next/navigation"
import {
    Category,
    PostType
} from "@prisma/client"
import {
    Loader2,
    Radio
} from "lucide-react"
import { getFeedAction } from "@/actions/fan/feed"
import {
    FeedSideNav,
    FeedTab
} from "./FeedSideNav"
import { ShortsRail } from "./ShortsRail"
import { PostCard } from "./PostCard"
import { ShortsPlayer } from "./ShortsPlayer"
import { FanMessagesClient } from "@/component/fan/messages/FanMessagesClient"
import { CommentModal }      from "./CommentModal"
import { CATEGORIES } from "@/component/onboarding/CategoryPicker"
import "@/styles/fan/Feed.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type LiveStream = {
    id: string; title: string
    creator: { id: string; displayName: string; handle: string | null; user: { image: string | null } }
}

type FeedPost = Awaited<ReturnType<typeof getFeedAction>>["posts"][number]

type FeedShort = {  // or ShortFeedItem, PrismaShort, etc.
    id: string;
    type: PostType;
    title: string | null;
    thumbnailUrl: string | null;
    videoDuration: number | null;
    hasAccess: boolean;
    likeCount: number;
    commentCount: number;
    isLiked: boolean;
    isSaved: boolean;
    isPurchased: boolean;
    lockReason: string | null;
    unlockPrice: number | null;
    mediaUrls: string[];
    body: string | null;
    publishedAt: Date | string | null;
    creator: {
        id: string;
        displayName: string;
        handle: string | null;
        isVerified: boolean;
        image: string | null;
        isLive?: boolean;
    };
}

type Props = {
    initialPosts:  FeedPost[]
    initialShorts: FeedShort[]
    liveStreams:   LiveStream[]
    fanCategories: Category[]
    currentUserId: string
}

// ─── Coming Soon ──────────────────────────────────────────────────────────────

const LiveComingSoon = () => (
    <div className="feed-live-soon">
        <div className="feed-live-soon__icon">
            <Radio size={40} />
        </div>
        <h3>Live is coming soon</h3>
        <p>
            We're building real-time streaming for NESORA creators.
            Follow your favourite creators to get notified when they go live.
        </p>
    </div>
)

// ── FeedClient ────────────────────────────────────────────────────────────────

export const FeedClient = ({
    initialPosts,
    initialShorts,
    liveStreams,
    fanCategories,
    currentUserId,
}: Props) => {
    const router       = useRouter()
    const searchParams = useSearchParams()

    // ── Tab state — read from ?tab= on mount ──────────────────────────────────
    const [activeTab,      setActiveTab]      = useState<FeedTab>(() => {
        const t = searchParams.get("tab")
        return (t === "shorts" || t === "live" || t === "chat") ? t : "feed"
    })

    // Shorts player state
    const [shortsStartIndex, setShortsStartIndex] = useState(0)

    // Feed state
    const [posts, setPosts] = useState<FeedPost[]>(initialPosts)
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(initialPosts.length >= 20)
    const [activeCategory, setActiveCategory] = useState<Category | "ALL">("ALL")
    const [loadingMore, setLoadingMore] = useState(false)

    // Modal state (wired up in next phase)
    const [commentPostId, setCommentPostId] = useState<string | null>(null)
    const [giftCreatorId, setGiftCreatorId] = useState<string | null>(null)
    const [unlockPost, setUnlockPost] = useState<FeedPost | null>(null)

    const [, startTransition] = useTransition()

    // ── Post update handler (optimistic UI from PostCard) ─────────────────────
    const handlePostUpdate = useCallback((id: string, updates: Partial<FeedPost>) => {
        setPosts((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
        )
    }, [])

    const liveCreatorIds = new Set(liveStreams.map((s) => s.creator.id))

    // ── Sync tab → URL ────────────────────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (activeTab === "feed") {
            params.delete("tab")
        } else {
            params.set("tab", activeTab)
        }
        const query = params.toString()
        router.replace(`/fan/feed${query ? `?${query}` : ""}`, { scroll: false })
    }, [activeTab])

    // ── Tab change ────────────────────────────────────────────────────────────
    const handleTabChange = (tab: FeedTab) => {
        setActiveTab(tab)
        // When switching back to feed, reset shorts start index
        if (tab === "feed") setShortsStartIndex(0)
    }

    // ── Short clicked from rail → jump to shorts tab at that index ────────────
    const handleShortClick = (shortId: string) => {
        const idx = initialShorts.findIndex((s) => s.id === shortId)
        setShortsStartIndex(idx >= 0 ? idx : 0)
        setActiveTab("shorts")
    }

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
        const data = await getFeedAction({ category: activeCategory, page: nextPage })
        setPosts((prev) => {
            const ids = new Set(prev.map((p) => p.id))
            return [...prev, ...data.posts.filter((p) => !ids.has(p.id))]
        })
        setPage(nextPage)
        setHasMore(data.posts.length >= 20)
        setLoadingMore(false)
    }, [loadingMore, hasMore, page, activeCategory])

    // ── Category chips ────────────────────────────────────────────────────────
    const chips = [
        { value: "ALL" as const, label: "All", emoji: "✨" },
        ...CATEGORIES.filter((c) => fanCategories.includes(c.value)),
    ]

    // ── Inject live flag into posts ───────────────────────────────────────────
    const postsWithLive = posts.map((post) => ({
        ...post,
        creator: { ...post.creator, isLive: liveCreatorIds.has(post.creator.id) },
    }))

    // ── Shorts with live flag ─────────────────────────────────────────────────
    const shortsWithLive = initialShorts.map((s) => ({
        ...s,
        // Convert string timestamps to proper Date objects if present
        publishedAt: s.publishedAt ? new Date(s.publishedAt) : null,
        creator: { ...s.creator, isLive: liveCreatorIds.has(s.creator.id) },
    })) as any;

    return (
        <div className="feed-layout">

            {/* Side nav */}
            <FeedSideNav
                activeTab={activeTab}
                onTabChange={handleTabChange}
                liveCount={liveStreams.length}
            />

            {/* Main column */}
            <div className="feed-main">

                {/* ── FEED TAB ─────────────────────────────────────────────── */}
                {activeTab === "feed" && (
                    <>
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

                        {/* Shorts rail — clicking a short jumps to shorts tab */}
                        <ShortsRail
                            shorts={initialShorts}
                            onShortClick={handleShortClick}
                            onSeeAll={() => handleTabChange("shorts")}
                        />

                        {/* Posts */}
                        <div className="feed-posts">
                            {postsWithLive.length === 0 && (
                                <div className="feed-empty">
                                    <p>No posts yet in this category.</p>
                                    <p>Follow more creators to fill your feed.</p>
                                </div>
                            )}

                            {postsWithLive.map((post) => (
                                <PostCard
                                    key={post.id}
                                    post={post as any}
                                    userId={currentUserId}
                                    onUpdate={handlePostUpdate}
                                    onCommentOpen={(id) => setCommentPostId(id)}
                                    onGiftOpen={(id) => setGiftCreatorId(id)}
                                    onUnlockOpen={(p) => setUnlockPost(p as any)}
                                />
                            ))}

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
                    </>
                )}

                {/* ── SHORTS TAB ───────────────────────────────────────────── */}
                {activeTab === "shorts" && (
                    <ShortsPlayer
                        initialShorts={shortsWithLive}
                        startIndex={shortsStartIndex}
                    />
                )}

                {/* ── LIVE TAB ─────────────────────────────────────────────── */}
                {activeTab === "live" && <LiveComingSoon />}

                {/* ── CHAT TAB ─────────────────────────────────────────────── */}
                {activeTab === "chat" && (
                    <FanMessagesClient currentUserId={currentUserId} />
                )}

            </div>

            {/* ── Comment modal ── */}
            {commentPostId && (
                <CommentModal
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

            {/* Modal backdrops — gift & unlock wired in next phase */}
            {giftCreatorId && <div className="feed-backdrop" onClick={() => setGiftCreatorId(null)} aria-hidden="true" />}
            {unlockPost    && <div className="feed-backdrop" onClick={() => setUnlockPost(null)}    aria-hidden="true" />}

        </div>
    )
}
