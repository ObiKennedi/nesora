// component/creator-profile/ProfileGrid.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
    Grid3x3,
    Clapperboard,
    Lock,
    Play,
    Layers,
    FileText,
    BarChart3,
    Music,
    Heart,
    MessageCircle,
    Loader2,
} from "lucide-react"
import { getCreatorGridPostsAction, type GridPost } from "@/actions/creator-profile"

type Tab = "posts" | "shorts"

type TabState = {
    posts:   GridPost[]
    cursor:  string | null
    loaded:  boolean
    loading: boolean
}

type Props = {
    username:      string
    initialPosts:  GridPost[]
    initialCursor: string | null
    /** When provided, tapping a locked tile opens the subscribe flow instead of navigating */
    onLockedClick?: () => void
}

const LOCK_LABELS: Record<GridPost["accessLevel"], string> = {
    PUBLIC:           "",
    FOLLOWERS_ONLY:   "Followers only",
    SUBSCRIBERS_ONLY: "Subscribers only",
    PLAN_SPECIFIC:    "Plan exclusive",
    TOP_FANS_ONLY:    "Top fans only",
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, "0")}`
}

export default function ProfileGrid({
    username,
    initialPosts,
    initialCursor,
    onLockedClick,
}: Props) {
    const [activeTab, setActiveTab] = useState<Tab>("posts")
    const [tabs, setTabs] = useState<Record<Tab, TabState>>({
        posts:  { posts: initialPosts, cursor: initialCursor, loaded: true, loading: false },
        shorts: { posts: [], cursor: null, loaded: false, loading: false },
    })

    const sentinelRef = useRef<HTMLDivElement>(null)
    const current     = tabs[activeTab]

    const loadMore = useCallback(async (tab: Tab, cursor: string | null, append: boolean) => {
        setTabs((prev) => ({ ...prev, [tab]: { ...prev[tab], loading: true } }))

        const result = await getCreatorGridPostsAction({ identifier: username, tab, cursor })

        setTabs((prev) => {
            if (result.status !== "success") {
                return { ...prev, [tab]: { ...prev[tab], loading: false, loaded: true } }
            }
            return {
                ...prev,
                [tab]: {
                    posts:   append ? [...prev[tab].posts, ...result.posts] : result.posts,
                    cursor:  result.nextCursor,
                    loaded:  true,
                    loading: false,
                },
            }
        })
    }, [username])

    // Lazy-load the shorts tab on first visit
    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab)
        if (!tabs[tab].loaded && !tabs[tab].loading) {
            void loadMore(tab, null, false)
        }
    }

    // Infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (
                    entries[0].isIntersecting &&
                    current.cursor &&
                    !current.loading
                ) {
                    void loadMore(activeTab, current.cursor, true)
                }
            },
            { rootMargin: "400px" }
        )

        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [activeTab, current.cursor, current.loading, loadMore])

    return (
        <div className="profile-grid">
            {/* ── Tabs ── */}
            <div className="profile-grid__tabs" role="tablist">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "posts"}
                    className={`profile-grid__tab ${activeTab === "posts" ? "profile-grid__tab--active" : ""}`}
                    onClick={() => handleTabChange("posts")}
                >
                    <Grid3x3 size={16} /> Posts
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "shorts"}
                    className={`profile-grid__tab ${activeTab === "shorts" ? "profile-grid__tab--active" : ""}`}
                    onClick={() => handleTabChange("shorts")}
                >
                    <Clapperboard size={16} /> Shorts
                </button>
            </div>

            {/* ── Grid ── */}
            {current.posts.length === 0 && current.loaded && !current.loading ? (
                <div className="profile-grid__empty">
                    <p>No {activeTab} yet</p>
                </div>
            ) : (
                <div className="profile-grid__grid">
                    {current.posts.map((post) => (
                        <GridTile
                            key={post.id}
                            post={post}
                            username={username}
                            onLockedClick={onLockedClick}
                        />
                    ))}
                </div>
            )}

            {current.loading && (
                <div className="profile-grid__loader">
                    <Loader2 size={20} className="profile-grid__spinner" />
                </div>
            )}

            <div ref={sentinelRef} className="profile-grid__sentinel" aria-hidden />
        </div>
    )
}

// ── Tile ──────────────────────────────────────────────────────────────────────

function GridTile({
    post,
    username,
    onLockedClick,
}: {
    post:           GridPost
    username:       string
    onLockedClick?: () => void
}) {
    const href = `/fan/${username}/post/${post.id}`

    const tileInner = (
        <>
            {/* Media / text layer */}
            {post.thumbnailUrl || post.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={post.thumbnailUrl ?? post.previewUrl ?? ""}
                    alt=""
                    className={`profile-grid__tile-media ${!post.unlocked ? "profile-grid__tile-media--blurred" : ""}`}
                    loading="lazy"
                />
            ) : (
                <div className={`profile-grid__tile-text ${!post.unlocked ? "profile-grid__tile-text--blurred" : ""}`}>
                    {post.type === "POLL" && <BarChart3 size={20} />}
                    {post.type === "TEXT" && <FileText size={20} />}
                    {post.type === "AUDIO" && <Music size={20} />}
                    {post.snippet && <p>{post.snippet}</p>}
                </div>
            )}

            {/* Type indicators (top-right) */}
            <div className="profile-grid__tile-indicators">
                {post.type === "VIDEO" && <Play size={14} fill="currentColor" />}
                {post.type === "AUDIO" && <Music size={14} />}
                {post.mediaCount > 1 && <Layers size={14} />}
            </div>

            {post.type === "VIDEO" && post.videoDuration != null && post.unlocked && (
                <span className="profile-grid__tile-duration">{formatDuration(post.videoDuration)}</span>
            )}

            {/* Lock overlay */}
            {!post.unlocked && (
                <div className="profile-grid__tile-lock">
                    <Lock size={20} />
                    <span>{LOCK_LABELS[post.accessLevel]}</span>
                </div>
            )}

            {/* Hover stats (unlocked only) */}
            {post.unlocked && (
                <div className="profile-grid__tile-hover">
                    <span><Heart size={16} fill="currentColor" /> {post.likeCount}</span>
                    <span><MessageCircle size={16} fill="currentColor" /> {post.commentCount}</span>
                </div>
            )}
        </>
    )

    // Locked tiles route to the subscribe flow when available;
    // otherwise (and for unlocked tiles) they navigate to the post view,
    // which renders the paywall state itself.
    if (!post.unlocked && onLockedClick) {
        return (
            <button type="button" className="profile-grid__tile" onClick={onLockedClick}>
                {tileInner}
            </button>
        )
    }

    return (
        <Link href={href} className="profile-grid__tile" scroll={false}>
            {tileInner}
        </Link>
    )
}