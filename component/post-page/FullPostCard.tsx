// component/post-page/FullPostCard.tsx
"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import {
    Lock, Loader2, ChevronLeft, ChevronRight, Heart, MessageCircle,
    Bookmark, Share2, Music, FileText, Check,
} from "lucide-react"
import {
    likePostAction, unlikePostAction, savePostAction,
    recordShareAction, purchasePostAction, votePollAction,
} from "@/actions/fan/interactions"
import { getPostPageAction } from "@/actions/post-page"
import type { FullPost, PostCreatorSummary, PostAccessLevel } from "@/lib/post-access"
import CommentsSection from "@/component/post-page/CommentsSection"

const LOCK_LABELS: Record<PostAccessLevel, string> = {
    PUBLIC:           "",
    FOLLOWERS_ONLY:   "Followers only",
    SUBSCRIBERS_ONLY: "Subscribers only",
    PLAN_SPECIFIC:    "Plan exclusive",
    TOP_FANS_ONLY:    "Top fans only",
}

type Props = {
    post:                FullPost
    creator:             PostCreatorSummary
    viewerAuthenticated: boolean
}

export default function FullPostCard({
    post: initialPost,
    creator,
    viewerAuthenticated,
}: Props) {
    // The card owns its post so it can refresh itself after an unlock
    const [post, setPost] = useState<FullPost>(initialPost)

    const [mediaIndex,   setMediaIndex]   = useState(0)
    const [liked,        setLiked]        = useState(initialPost.viewerLiked)
    const [likeCount,    setLikeCount]    = useState(initialPost.likeCount)
    const [saved,        setSaved]        = useState(initialPost.viewerSaved)
    const [commentsOpen, setCommentsOpen] = useState(false)
    const [shareNote,    setShareNote]    = useState<string | null>(null)
    const [purchasing,   setPurchasing]   = useState(false)
    const [purchaseMsg,  setPurchaseMsg]  = useState<string | null>(null)
    const [pollBusy,     setPollBusy]     = useState(false)
    const [pollError,    setPollError]    = useState<string | null>(null)

    const mediaCount   = post.mediaUrls.length
    const currentMedia = post.mediaUrls[mediaIndex] ?? null
    const postUrl      = `/fan/${creator.username}/post/${post.id}`

    // ── Like (optimistic) ─────────────────────────────────────────────────────
    const toggleLike = useCallback(async () => {
        const next = !liked
        setLiked(next)
        setLikeCount((c) => c + (next ? 1 : -1))

        const result = next
            ? await likePostAction(post.id)
            : await unlikePostAction(post.id)

        if (!result?.success) {
            setLiked(!next)
            setLikeCount((c) => c + (next ? -1 : 1))
        }
    }, [liked, post.id])

    // ── Save (optimistic) ─────────────────────────────────────────────────────
    const toggleSave = useCallback(async () => {
        const next = !saved
        setSaved(next)
        const result = await savePostAction(post.id)
        if (!result?.success) setSaved(!next)
        else setSaved(result.saved)
    }, [saved, post.id])

    // ── Share ─────────────────────────────────────────────────────────────────
    const share = useCallback(async () => {
        const url = `${window.location.origin}${postUrl}`
        void recordShareAction(post.id)

        if (navigator.share) {
            try { await navigator.share({ url }) } catch { /* user dismissed */ }
        } else {
            await navigator.clipboard.writeText(url)
            setShareNote("Link copied")
            setTimeout(() => setShareNote(null), 2000)
        }
    }, [post.id, postUrl])

    // ── PPV unlock ────────────────────────────────────────────────────────────
    const unlock = useCallback(async () => {
        setPurchasing(true)
        setPurchaseMsg(null)

        const result = await purchasePostAction(post.id)

        if (result?.success) {
            // Re-fetch the now-unlocked payload through the same gated path
            const fresh = await getPostPageAction(post.id)
            if (fresh.status === "success") {
                setPost(fresh.post)
                setMediaIndex(0)
            }
        } else if (result?.code === "INSUFFICIENT_FUNDS") {
            setPurchaseMsg(
                `You need ₦${result.shortfall?.toLocaleString()} more to unlock this post.`
            )
        } else if (result?.error) {
            setPurchaseMsg(result.error)
        }

        setPurchasing(false)
    }, [post.id])

    // ── Poll vote (optimistic) ────────────────────────────────────────────────
    const vote = useCallback(async (optionId: string) => {
        if (!post.poll || post.poll.viewerOptionId || pollBusy) return

        setPollBusy(true)
        setPollError(null)

        const previous = post.poll
        setPost((p) => p.poll ? {
            ...p,
            poll: {
                ...p.poll,
                viewerOptionId: optionId,
                totalVotes:     p.poll.totalVotes + 1,
                options: p.poll.options.map((o) =>
                    o.id === optionId ? { ...o, votes: o.votes + 1 } : o
                ),
            },
        } : p)

        const result = await votePollAction(optionId)
        if (result?.error) {
            setPost((p) => ({ ...p, poll: previous }))
            setPollError(result.error)
        }

        setPollBusy(false)
    }, [post.poll, pollBusy])

    // ── Locked ────────────────────────────────────────────────────────────────
    if (!post.unlocked) {
        return (
            <article className="full-post full-post--locked" data-post-id={post.id}>
                {post.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="full-post__locked-backdrop"
                        aria-hidden
                    />
                )}
                <div className="full-post__locked-body">
                    <Lock size={28} />
                    <p className="full-post__locked-label">
                        {LOCK_LABELS[post.accessLevel] || "Locked"}
                    </p>

                    <div className="full-post__locked-actions">
                        {post.unlockPrice !== null && (
                            <button
                                type="button"
                                className="full-post__unlock-btn"
                                onClick={unlock}
                                disabled={purchasing}
                            >
                                {purchasing
                                    ? <Loader2 size={16} className="full-post__spinner" />
                                    : <>Unlock for ₦{post.unlockPrice.toLocaleString()}</>}
                            </button>
                        )}
                        <Link
                            href={`/fan/${creator.username}`}
                            className="full-post__subscribe-link"
                        >
                            Subscribe on profile
                        </Link>
                    </div>

                    {purchaseMsg && (
                        <p className="full-post__purchase-msg" role="alert">{purchaseMsg}</p>
                    )}
                </div>
            </article>
        )
    }

    // ── Unlocked ──────────────────────────────────────────────────────────────
    return (
        <article className="full-post" data-post-id={post.id}>
            {/* Media */}
            {currentMedia && post.type === "PHOTO" && (
                <div className="full-post__media">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentMedia} alt={post.title ?? ""} />
                    <CarouselControls
                        index={mediaIndex}
                        count={mediaCount}
                        onPrev={() => setMediaIndex((i) => Math.max(0, i - 1))}
                        onNext={() => setMediaIndex((i) => Math.min(mediaCount - 1, i + 1))}
                    />
                </div>
            )}

            {currentMedia && post.type === "VIDEO" && (
                <div className="full-post__media">
                    {/* Cloudinary MP4s — native video is fine (unlike IVS HLS) */}
                    <video src={currentMedia} controls playsInline preload="metadata" />
                </div>
            )}

            {currentMedia && post.type === "AUDIO" && (
                <div className="full-post__media full-post__media--audio">
                    <Music size={32} />
                    <audio src={currentMedia} controls preload="metadata" />
                </div>
            )}

            {post.type === "TEXT" && !post.body && (
                <div className="full-post__media full-post__media--text">
                    <FileText size={28} />
                </div>
            )}

            {/* Body */}
            <div className="full-post__body">
                {post.title && <h2 className="full-post__title">{post.title}</h2>}
                {post.body  && <p className="full-post__text">{post.body}</p>}

                {/* Poll — live voting */}
                {post.type === "POLL" && post.poll && (
                    <div className="full-post__poll">
                        <ul className="full-post__poll-options">
                            {post.poll.options.map((option) => {
                                const percent = post.poll!.totalVotes > 0
                                    ? Math.round((option.votes / post.poll!.totalVotes) * 100)
                                    : 0
                                const isMine  = option.id === post.poll!.viewerOptionId
                                const canVote = !post.poll!.viewerOptionId && !pollBusy

                                return (
                                    <li key={option.id}>
                                        <button
                                            type="button"
                                            className={`full-post__poll-option ${isMine ? "full-post__poll-option--mine" : ""} ${canVote ? "full-post__poll-option--votable" : ""}`}
                                            onClick={() => canVote && vote(option.id)}
                                            disabled={!canVote}
                                        >
                                            <span
                                                className="full-post__poll-fill"
                                                style={{ width: post.poll!.viewerOptionId ? `${percent}%` : "0%" }}
                                                aria-hidden
                                            />
                                            <span className="full-post__poll-label">
                                                {option.text}
                                                {isMine && <Check size={14} aria-label="Your vote" />}
                                            </span>
                                            {post.poll!.viewerOptionId && (
                                                <span className="full-post__poll-percent">{percent}%</span>
                                            )}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                        <p className="full-post__poll-total">
                            {post.poll.totalVotes.toLocaleString("en-NG")}{" "}
                            {post.poll.totalVotes === 1 ? "vote" : "votes"}
                            {!post.poll.viewerOptionId && " • Tap an option to vote"}
                        </p>
                        {pollError && (
                            <p className="full-post__poll-error" role="alert">{pollError}</p>
                        )}
                    </div>
                )}

                {post.publishedAt && (
                    <p className="full-post__date">
                        {new Date(post.publishedAt).toLocaleDateString("en-NG", {
                            day: "numeric", month: "short", year: "numeric",
                        })}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="full-post__actions">
                <button
                    type="button"
                    className={`full-post__action ${liked ? "full-post__action--active" : ""}`}
                    onClick={toggleLike}
                    aria-pressed={liked}
                    aria-label={liked ? "Unlike" : "Like"}
                >
                    <Heart size={20} fill={liked ? "currentColor" : "none"} />
                    <span>{likeCount.toLocaleString("en-NG")}</span>
                </button>

                <button
                    type="button"
                    className={`full-post__action ${commentsOpen ? "full-post__action--active" : ""}`}
                    onClick={() => setCommentsOpen((o) => !o)}
                    aria-expanded={commentsOpen}
                    aria-label="Comments"
                >
                    <MessageCircle size={20} />
                    <span>{post.commentCount.toLocaleString("en-NG")}</span>
                </button>

                <button
                    type="button"
                    className={`full-post__action ${saved ? "full-post__action--active" : ""}`}
                    onClick={toggleSave}
                    aria-pressed={saved}
                    aria-label={saved ? "Unsave" : "Save"}
                >
                    <Bookmark size={20} fill={saved ? "currentColor" : "none"} />
                </button>

                <button
                    type="button"
                    className="full-post__action"
                    onClick={share}
                    aria-label="Share"
                >
                    <Share2 size={20} />
                    {shareNote && <span className="full-post__share-note">{shareNote}</span>}
                </button>
            </div>

            {/* Comments */}
            {commentsOpen && (
                <CommentsSection
                    postId={post.id}
                    viewerAuthenticated={viewerAuthenticated}
                />
            )}
        </article>
    )
}

// ── Carousel controls (photos with multiple media) ───────────────────────────

function CarouselControls({
    index, count, onPrev, onNext,
}: {
    index: number; count: number; onPrev: () => void; onNext: () => void
}) {
    if (count <= 1) return null
    return (
        <>
            {index > 0 && (
                <button
                    type="button"
                    className="full-post__nav full-post__nav--prev"
                    onClick={onPrev}
                    aria-label="Previous"
                >
                    <ChevronLeft size={22} />
                </button>
            )}
            {index < count - 1 && (
                <button
                    type="button"
                    className="full-post__nav full-post__nav--next"
                    onClick={onNext}
                    aria-label="Next"
                >
                    <ChevronRight size={22} />
                </button>
            )}
            <div className="full-post__dots">
                {Array.from({ length: count }).map((_, i) => (
                    <span
                        key={i}
                        className={`full-post__dot ${i === index ? "full-post__dot--active" : ""}`}
                    />
                ))}
            </div>
        </>
    )
}