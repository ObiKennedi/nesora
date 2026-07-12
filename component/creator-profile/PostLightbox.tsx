// component/creator-profile/PostLightbox.tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
    X, Lock, Loader2, ChevronLeft, ChevronRight,
    Heart, MessageCircle, FileText, Music, Check,
} from "lucide-react"
import { getPostForModalAction, type ModalPost } from "@/actions/creator-profile"
import "@/styles/creator-profile/post-lightbox.scss"

const LOCK_LABELS: Record<ModalPost["accessLevel"], string> = {
    PUBLIC:           "",
    FOLLOWERS_ONLY:   "Followers only",
    SUBSCRIBERS_ONLY: "Subscribers only",
    PLAN_SPECIFIC:    "Plan exclusive",
    TOP_FANS_ONLY:    "Top fans only",
}

type Props = {
    postId:   string
    username: string
    onClose:  () => void
    /** Opens the subscribe flow for locked posts (when the viewer can subscribe) */
    onSubscribeClick?: () => void
}

export default function PostLightbox({
    postId,
    username,
    onClose,
    onSubscribeClick,
}: Props) {
    const [post,       setPost]       = useState<ModalPost | null>(null)
    const [error,      setError]      = useState<string | null>(null)
    const [mediaIndex, setMediaIndex] = useState(0)

    // ── Fetch the gated payload ───────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false

        setPost(null)
        setError(null)
        setMediaIndex(0)

        void getPostForModalAction(postId).then((result) => {
            if (cancelled) return
            if (result.status === "success") setPost(result.post)
            else setError(result.status === "not_found" ? "This post is no longer available." : result.message)
        })

        return () => { cancelled = true }
    }, [postId])

    // ── Body scroll lock while open ───────────────────────────────────────────
    useEffect(() => {
        const previous = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = previous }
    }, [])

    // ── Keyboard: Escape closes, arrows page media ────────────────────────────
    const mediaCount = post?.mediaUrls.length ?? 0

    const goPrev = useCallback(() => {
        setMediaIndex((i) => (i > 0 ? i - 1 : i))
    }, [])
    const goNext = useCallback(() => {
        setMediaIndex((i) => (i < mediaCount - 1 ? i + 1 : i))
    }, [mediaCount])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape")     onClose()
            if (e.key === "ArrowLeft")  goPrev()
            if (e.key === "ArrowRight") goNext()
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [onClose, goPrev, goNext])

    const currentMedia = post?.mediaUrls[mediaIndex] ?? null

    return (
        <div
            className="post-lightbox"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                // Backdrop click closes; clicks inside the panel don't
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <button
                type="button"
                className="post-lightbox__close"
                onClick={onClose}
                aria-label="Close"
            >
                <X size={22} />
            </button>

            <div className="post-lightbox__panel">
                {/* ── Loading ── */}
                {!post && !error && (
                    <div className="post-lightbox__state">
                        <Loader2 size={24} className="post-lightbox__spinner" />
                    </div>
                )}

                {/* ── Error ── */}
                {error && (
                    <div className="post-lightbox__state">
                        <p>{error}</p>
                    </div>
                )}

                {/* ── Locked ── */}
                {post && !post.unlocked && (
                    <div className="post-lightbox__locked">
                        {post.thumbnailUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={post.thumbnailUrl}
                                alt=""
                                className="post-lightbox__locked-backdrop"
                                aria-hidden
                            />
                        )}
                        <div className="post-lightbox__locked-body">
                            <Lock size={28} />
                            <p className="post-lightbox__locked-label">
                                {LOCK_LABELS[post.accessLevel] || "Locked"}
                            </p>
                            {onSubscribeClick ? (
                                <button
                                    type="button"
                                    className="post-lightbox__subscribe"
                                    onClick={() => {
                                        onClose()
                                        onSubscribeClick()
                                    }}
                                >
                                    Subscribe to unlock
                                </button>
                            ) : (
                                <Link
                                    href={`/fan/${username}/post/${post.id}`}
                                    className="post-lightbox__subscribe"
                                >
                                    View post
                                </Link>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Unlocked ── */}
                {post && post.unlocked && (
                    <div className="post-lightbox__content">
                        {/* Media side */}
                        {(currentMedia || post.type === "TEXT" || post.type === "POLL") && (
                            <div className="post-lightbox__media">
                                {post.type === "PHOTO" && currentMedia && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={currentMedia} alt={post.title ?? ""} />
                                )}

                                {post.type === "VIDEO" && currentMedia && (
                                    // Post videos are Cloudinary MP4s — native
                                    // video is fine here (unlike IVS HLS streams)
                                    <video src={currentMedia} controls playsInline autoPlay />
                                )}

                                {post.type === "AUDIO" && currentMedia && (
                                    <div className="post-lightbox__audio">
                                        <Music size={32} />
                                        <audio src={currentMedia} controls preload="metadata" />
                                    </div>
                                )}

                                {post.type === "TEXT" && (
                                    <div className="post-lightbox__text-card">
                                        <FileText size={28} />
                                    </div>
                                )}

                                {/* Poll — read-only results; voting lives on the post page */}
                                {post.type === "POLL" && post.poll && (
                                    <div className="post-lightbox__poll">
                                        <ul className="post-lightbox__poll-options">
                                            {post.poll.options.map((option) => {
                                                const percent = post.poll!.totalVotes > 0
                                                    ? Math.round((option.votes / post.poll!.totalVotes) * 100)
                                                    : 0
                                                const isMine = option.id === post.poll!.viewerOptionId

                                                return (
                                                    <li
                                                        key={option.id}
                                                        className={`post-lightbox__poll-option ${isMine ? "post-lightbox__poll-option--mine" : ""}`}
                                                    >
                                                        <span
                                                            className="post-lightbox__poll-fill"
                                                            style={{ width: `${percent}%` }}
                                                            aria-hidden
                                                        />
                                                        <span className="post-lightbox__poll-label">
                                                            {option.text}
                                                            {isMine && <Check size={14} aria-label="Your vote" />}
                                                        </span>
                                                        <span className="post-lightbox__poll-percent">
                                                            {percent}%
                                                        </span>
                                                    </li>
                                                )
                                            })}
                                        </ul>
                                        <p className="post-lightbox__poll-total">
                                            {post.poll.totalVotes.toLocaleString("en-NG")}{" "}
                                            {post.poll.totalVotes === 1 ? "vote" : "votes"}
                                        </p>
                                    </div>
                                )}

                                {/* Carousel controls */}
                                {mediaCount > 1 && (
                                    <>
                                        {mediaIndex > 0 && (
                                            <button
                                                type="button"
                                                className="post-lightbox__nav post-lightbox__nav--prev"
                                                onClick={goPrev}
                                                aria-label="Previous"
                                            >
                                                <ChevronLeft size={22} />
                                            </button>
                                        )}
                                        {mediaIndex < mediaCount - 1 && (
                                            <button
                                                type="button"
                                                className="post-lightbox__nav post-lightbox__nav--next"
                                                onClick={goNext}
                                                aria-label="Next"
                                            >
                                                <ChevronRight size={22} />
                                            </button>
                                        )}
                                        <div className="post-lightbox__dots">
                                            {post.mediaUrls.map((_, i) => (
                                                <span
                                                    key={i}
                                                    className={`post-lightbox__dot ${i === mediaIndex ? "post-lightbox__dot--active" : ""}`}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Details side */}
                        <div className="post-lightbox__details">
                            {post.title && <h2 className="post-lightbox__title">{post.title}</h2>}
                            {post.body  && <p className="post-lightbox__body">{post.body}</p>}

                            <div className="post-lightbox__meta">
                                <span><Heart size={15} /> {post.likeCount}</span>
                                <span><MessageCircle size={15} /> {post.commentCount}</span>
                                {post.publishedAt && (
                                    <span className="post-lightbox__date">
                                        {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                                            day: "numeric", month: "short", year: "numeric",
                                        })}
                                    </span>
                                )}
                            </div>

                            <Link
                                href={`/fan/${username}/post/${post.id}`}
                                className="post-lightbox__full-link"
                            >
                                View full post
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}