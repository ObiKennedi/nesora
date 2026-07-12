// component/post-page/PostFeedClient.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { getNextCreatorPostAction } from "@/actions/post-page"
import type { FullPost, PostCreatorSummary } from "@/lib/post-access"
import FullPostCard from "@/component/post-page/FullPostCard"
import "@/styles/post-page/post-page.scss"

type Props = {
    initialPost:         FullPost
    creator:             PostCreatorSummary
    viewerAuthenticated: boolean
}

export default function PostFeedClient({
    initialPost,
    creator,
    viewerAuthenticated,
}: Props) {
    const [posts,   setPosts]   = useState<FullPost[]>([initialPost])
    const [ended,   setEnded]   = useState(false)
    const [loading, setLoading] = useState(false)

    const loadingRef  = useRef(false)
    const sentinelRef = useRef<HTMLDivElement | null>(null)
    const listRef     = useRef<HTMLDivElement | null>(null)

    // ── Load the next post when the sentinel comes into view ─────────────────
    const loadNext = useCallback(async () => {
        if (loadingRef.current || ended) return
        loadingRef.current = true
        setLoading(true)

        const last   = posts[posts.length - 1]
        const result = await getNextCreatorPostAction({
            creatorId:   creator.id,
            afterPostId: last.id,
        })

        if (result.status === "success") {
            setPosts((prev) =>
                prev.some((p) => p.id === result.post.id) ? prev : [...prev, result.post]
            )
        } else {
            // "end" and "error" both stop the feed — an error mid-scroll
            // shouldn't hammer the server in a retry loop
            setEnded(true)
        }

        loadingRef.current = false
        setLoading(false)
    }, [posts, ended, creator.id])

    useEffect(() => {
        const sentinel = sentinelRef.current
        if (!sentinel || ended) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) void loadNext()
            },
            { rootMargin: "600px 0px" } // start fetching well before the bottom
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [loadNext, ended])

    // ── Keep the URL pointing at the post currently in view ──────────────────
    useEffect(() => {
        const list = listRef.current
        if (!list) return

        const articles = Array.from(
            list.querySelectorAll<HTMLElement>("[data-post-id]")
        )
        if (articles.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        const id = entry.target.getAttribute("data-post-id")
                        if (id) {
                            window.history.replaceState(
                                null, "", `/fan/${creator.username}/post/${id}`
                            )
                        }
                    }
                }
            },
            { threshold: 0.5 }
        )
        articles.forEach((el) => observer.observe(el))
        return () => observer.disconnect()
    }, [posts.length, creator.username])

    return (
        <div className="post-page">
            {/* ── Top bar ── */}
            <header className="post-page__header">
                <Link
                    href={`/fan/${creator.username}`}
                    className="post-page__back"
                    aria-label={`Back to ${creator.displayName}'s profile`}
                >
                    <ArrowLeft size={20} />
                </Link>
                <div className="post-page__creator">
                    {creator.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={creator.image} alt="" className="post-page__avatar" />
                    ) : (
                        <span className="post-page__avatar post-page__avatar--fallback">
                            {creator.displayName.charAt(0).toUpperCase()}
                        </span>
                    )}
                    <div>
                        <p className="post-page__name">
                            {creator.displayName}
                            {creator.isVerified && (
                                <CheckCircle2 size={14} className="post-page__verified" />
                            )}
                        </p>
                        <p className="post-page__handle">@{creator.username}</p>
                    </div>
                </div>
            </header>

            {/* ── Feed ── */}
            <div className="post-page__list" ref={listRef}>
                {posts.map((post) => (
                    <FullPostCard
                        key={post.id}
                        post={post}
                        creator={creator}
                        viewerAuthenticated={viewerAuthenticated}
                    />
                ))}

                {!ended && <div ref={sentinelRef} className="post-page__sentinel" aria-hidden />}

                {loading && (
                    <div className="post-page__loading">
                        <Loader2 size={20} className="post-page__spinner" />
                    </div>
                )}

                {ended && (
                    <div className="post-page__end">
                        <p className="post-page__end-title">You&apos;re all caught up</p>
                        <p className="post-page__end-sub">
                            No more posts from {creator.displayName}
                        </p>
                        <Link href={`/fan/${creator.username}`} className="post-page__end-link">
                            Back to profile
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}