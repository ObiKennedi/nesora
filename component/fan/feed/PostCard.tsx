"use client"

import { useState, useTransition }     from "react"
import Link                             from "next/link"
import {
    Heart, MessageCircle, Bookmark,
    Share2, Lock, Gift, BadgeCheck,
    Play, Mic, BarChart2, Eye, Image,
}                                       from "lucide-react"
import { PostType, Category }           from "@prisma/client"
import {
    likePostAction,
    unlikePostAction,
    savePostAction,
    recordShareAction,
    purchasePostAction,
}                                       from "@/actions/fan/interactions"
import { recordPostViewAction }         from "@/actions/fan/feed"
import "@/styles/fan/PostCard.scss"

type Post = {
    id:           string
    type:         PostType
    title:        string | null
    body:         string | null
    mediaUrls:    string[]
    thumbnailUrl: string | null
    videoDuration?: number | null
    publishedAt:  Date | null
    createdAt:    Date
    likeCount:    number
    commentCount: number
    viewCount?:   number
    isLiked:      boolean
    isSaved:      boolean
    isPurchased:  boolean
    hasAccess:    boolean
    lockReason:   string | null
    unlockPrice:  number | null
    poll:         any | null
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        isVerified:  boolean
        image:       string | null
        categories:  Category[]
    }
}

type Props = {
    post:          Post
    userId:        string
    onUpdate:      (id: string, updates: Partial<Post>) => void
    compact?:      boolean
    onCommentOpen?: (id: string) => void
    onGiftOpen?:    (creatorId: string) => void
    onUnlockOpen?:  (post: Post) => void
}

function timeAgo(date: Date | null): string {
    if (!date) return ""
    const diff  = Date.now() - new Date(date).getTime()
    const mins  = Math.floor(diff / 60_000)
    const hours = Math.floor(diff / 3_600_000)
    const days  = Math.floor(diff / 86_400_000)
    if (mins < 1)   return "just now"
    if (mins < 60)  return `${mins}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

const TYPE_ICON: Record<string, React.ReactNode> = {
    VIDEO: <Play    size={11} />,
    AUDIO: <Mic     size={11} />,
    POLL:  <BarChart2 size={11} />,
}

export function PostCard({ post, userId, onUpdate, compact = false, onCommentOpen, onGiftOpen, onUnlockOpen }: Props) {
    const [isPending,    startTransition] = useTransition()
    const [showShare,    setShowShare]    = useState(false)
    const [purchased,    setPurchased]    = useState(false)
    const [purchaseErr,  setPurchaseErr]  = useState<string | null>(null)

    // ── Like toggle ───────────────────────────────────────────────────────────
    const handleLike = () => {
        if (!post.hasAccess) return
        onUpdate(post.id, {
            isLiked:   !post.isLiked,
            likeCount: post.isLiked ? post.likeCount - 1 : post.likeCount + 1,
        })
        startTransition(async () => {
            const action = post.isLiked ? unlikePostAction : likePostAction
            const res    = await action(post.id)
            if (!res.success) {
                onUpdate(post.id, { isLiked: post.isLiked, likeCount: post.likeCount })
            }
        })
    }

    // ── Save toggle ───────────────────────────────────────────────────────────
    const handleSave = () => {
        onUpdate(post.id, { isSaved: !post.isSaved })
        startTransition(async () => { await savePostAction(post.id) })
    }

    // ── Share ─────────────────────────────────────────────────────────────────
    const handleShare = async () => {
        const url = `${window.location.origin}/p/${post.id}`
        try {
            if (navigator.share) {
                await navigator.share({ title: post.title ?? "Check this out", url })
            } else {
                await navigator.clipboard.writeText(url)
                setShowShare(true)
                setTimeout(() => setShowShare(false), 2000)
            }
        } catch {}
        recordShareAction(post.id)
    }

    // ── One-time purchase ─────────────────────────────────────────────────────
    const handlePurchase = () => {
        setPurchaseErr(null)
        startTransition(async () => {
            const res = await purchasePostAction(post.id)
            if (res.success) {
                setPurchased(true)
                onUpdate(post.id, { hasAccess: true, isPurchased: true })
            } else if (res.code === "INSUFFICIENT_FUNDS") {
                setPurchaseErr(`You need ₦${res.shortfall?.toLocaleString()} more. Top up your wallet.`)
            } else {
                setPurchaseErr(res.error ?? "Purchase failed.")
            }
        })
    }

    const handleView = () => { recordPostViewAction(post.id) }

    const isVideo  = post.type === "VIDEO"
    const isAudio  = post.type === "AUDIO"
    const isPoll   = post.type === "POLL"
    const isPhoto  = post.type === "PHOTO"
    const hasMedia = post.mediaUrls.length > 0

    return (
        <article
            className={`post-card ${compact ? "post-card--compact" : ""} ${!post.hasAccess ? "post-card--locked" : ""}`}
            onMouseEnter={handleView}
        >
            {/* ── Creator row ─────────────────────────────────────────────── */}
            <div className="post-card__creator">
                <Link
                    href={`/profile/${post.creator.handle ?? post.creator.id}`}
                    className="post-card__creator-link"
                >
                    <div className="post-card__avatar">
                        {post.creator.image ? (
                            <img
                                src={post.creator.image}
                                alt={post.creator.displayName}
                                width={38}
                                height={38}
                                className="post-card__avatar-img"
                            />
                        ) : (
                            <span className="post-card__avatar-fallback">
                                {post.creator.displayName.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>

                    <div className="post-card__creator-meta">
                        <div className="post-card__creator-name">
                            {post.creator.displayName}
                            {post.creator.isVerified && (
                                <BadgeCheck size={13} className="post-card__verified" />
                            )}
                        </div>
                        <div className="post-card__creator-sub">
                            {post.creator.handle && (
                                <span className="post-card__handle">@{post.creator.handle}</span>
                            )}
                            <span className="post-card__dot">·</span>
                            <span className="post-card__time">
                                {timeAgo(post.publishedAt ?? post.createdAt)}
                            </span>
                            {TYPE_ICON[post.type] && (
                                <>
                                    <span className="post-card__dot">·</span>
                                    <span className="post-card__type-icon">
                                        {TYPE_ICON[post.type]}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </Link>

                {/* View count */}
                {post.viewCount && post.viewCount > 0 ? (
                    <span className="post-card__view-count">
                        <Eye size={13} />
                        {formatCount(post.viewCount)}
                    </span>
                ) : null}

                {/* Gift button */}
                <button
                    type="button"
                    className="post-card__gift-btn"
                    aria-label="Send gift"
                    onClick={() => onGiftOpen?.(post.creator.id)}
                >
                    <Gift size={15} />
                </button>
            </div>

            {/* ── Title ───────────────────────────────────────────────────── */}
            {post.title && (
                <h3 className="post-card__title">{post.title}</h3>
            )}

            {/* ── Media / content ─────────────────────────────────────────── */}
            <div className={`post-card__body ${!post.hasAccess ? "post-card__body--blur" : ""}`}>

                {/* Plain text body (TEXT posts, or text-only) */}
                {post.body && !isVideo && !isAudio && !isPhoto && (
                    <p className="post-card__text">{post.body}</p>
                )}

                {/* ── Photo + caption ─────────────────────────────────────── */}
                {isPhoto && hasMedia && (
                    <div className={`post-card__media-caption ${post.body ? "post-card__media-caption--with-caption" : "post-card__media-caption--no-caption"}`}>

                        {/* Photos — left panel (or full-width when no caption) */}
                        <div className={`post-card__photos post-card__photos--${Math.min(post.mediaUrls.length, 4)}`}>
                            {post.mediaUrls.slice(0, 4).map((url, i) => (
                                <div key={i} className="post-card__photo-wrap">
                                    <img
                                        src={url}
                                        alt={`Photo ${i + 1}`}
                                        className="post-card__photo"
                                    />
                                    {i === 3 && post.mediaUrls.length > 4 && (
                                        <div className="post-card__photo-more">
                                            +{post.mediaUrls.length - 4}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Caption — right panel, only rendered when body exists */}
                        {post.body && (
                            <div className="post-card__caption-panel">
                                <p className="post-card__caption-text">{post.body}</p>
                                <div className="post-card__caption-meta">
                                    <Image size={12} />
                                    {post.mediaUrls.length} {post.mediaUrls.length === 1 ? "photo" : "photos"}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Video ───────────────────────────────────────────────── */}
                {isVideo && (
                    <div className="post-card__video-wrap">
                        {post.hasAccess && hasMedia ? (
                            <video
                                src={post.mediaUrls[0]}
                                poster={post.thumbnailUrl ?? undefined}
                                controls
                                preload="metadata"
                                className="post-card__video"
                                onPlay={handleView}
                            />
                        ) : (
                            <div className="post-card__video-thumb">
                                {post.thumbnailUrl && (
                                    <img
                                        src={post.thumbnailUrl}
                                        alt="Video thumbnail"
                                        className="post-card__thumb-img"
                                    />
                                )}
                                <div className="post-card__play-icon">
                                    <Play size={28} />
                                </div>
                                {post.videoDuration && (
                                    <span className="post-card__video-duration">
                                        {Math.floor(post.videoDuration / 60)}:
                                        {String(post.videoDuration % 60).padStart(2, "0")}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Audio ───────────────────────────────────────────────── */}
                {isAudio && hasMedia && post.hasAccess && (
                    <audio
                        src={post.mediaUrls[0]}
                        controls
                        className="post-card__audio"
                        preload="metadata"
                    />
                )}

                {/* ── Poll ────────────────────────────────────────────────── */}
                {isPoll && post.poll && (
                    <div className="post-card__poll">
                        <p className="post-card__poll-q">{post.poll.question}</p>
                        <div className="post-card__poll-options">
                            {post.poll.options.map((opt: any) => (
                                <div key={opt.id} className="post-card__poll-option">
                                    <span>{opt.text}</span>
                                    <span className="post-card__poll-votes">
                                        {opt.voteCount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Locked overlay ──────────────────────────────────────────── */}
            {!post.hasAccess && (
                <div className="post-card__lock">
                    <div className="post-card__lock-inner">
                        <div className="post-card__lock-icon">
                            <Lock size={20} />
                        </div>

                        <div>
                            <p className="post-card__lock-label">
                                {post.lockReason === "FOLLOWERS_ONLY"   && "Follow to unlock"}
                                {post.lockReason === "SUBSCRIBERS_ONLY" && "Subscribe to unlock"}
                                {post.lockReason === "PLAN_SPECIFIC"    && "Upgrade plan to unlock"}
                                {post.lockReason === "TOP_FANS_ONLY"    && "Top fans only"}
                            </p>
                            <p className="post-card__lock-sub">
                                Join {post.creator.displayName}'s community to see this
                            </p>
                        </div>

                        <div className="post-card__lock-actions">
                            <Link
                                href={`/profile/${post.creator.handle ?? post.creator.id}`}
                                className="post-card__lock-subscribe"
                            >
                                Subscribe
                            </Link>

                            {post.unlockPrice && !purchased && (
                                <button
                                    type="button"
                                    className="post-card__lock-purchase"
                                    onClick={handlePurchase}
                                    disabled={isPending}
                                >
                                    Unlock for ₦{post.unlockPrice.toLocaleString()}
                                </button>
                            )}
                        </div>

                        {purchaseErr && (
                            <p className="post-card__lock-err">{purchaseErr}</p>
                        )}
                    </div>
                </div>
            )}

            {/* ── Action bar ──────────────────────────────────────────────── */}
            {!compact && (
                <div className="post-card__actions">
                    <button
                        type="button"
                        className={`post-card__action ${post.isLiked ? "post-card__action--liked" : ""}`}
                        onClick={handleLike}
                        disabled={isPending || !post.hasAccess}
                        aria-label={post.isLiked ? "Unlike" : "Like"}
                    >
                        <Heart size={17} className={post.isLiked ? "fill" : ""} />
                        {post.likeCount > 0 && <span>{formatCount(post.likeCount)}</span>}
                    </button>

                    <button
                        type="button"
                        className="post-card__action"
                        aria-label="Comment"
                        disabled={!post.hasAccess}
                        onClick={() => onCommentOpen?.(post.id)}
                    >
                        <MessageCircle size={17} />
                        {post.commentCount > 0 && <span>{formatCount(post.commentCount)}</span>}
                    </button>

                    <button
                        type="button"
                        className="post-card__action"
                        onClick={handleShare}
                        aria-label="Share"
                    >
                        {showShare
                            ? <span className="post-card__copied">Copied!</span>
                            : <Share2 size={17} />
                        }
                    </button>

                    <button
                        type="button"
                        className={`post-card__action post-card__action--save ${post.isSaved ? "post-card__action--saved" : ""}`}
                        onClick={handleSave}
                        disabled={isPending}
                        aria-label={post.isSaved ? "Unsave" : "Save"}
                    >
                        <Bookmark size={17} className={post.isSaved ? "fill" : ""} />
                    </button>
                </div>
            )}
        </article>
    )
}