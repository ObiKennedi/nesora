// components/fan/feed/PostCard.tsx
"use client"

import { useState, useRef, useTransition }      from "react"
import Link                                      from "next/link"
import {
    Heart, MessageCircle, Bookmark,
    Share2, Lock, Gift, BadgeCheck,
    Play, Pause, Eye, ChevronLeft, ChevronRight,
}                                                from "lucide-react"
import { PostType, Category }                    from "@prisma/client"
import {
    likePostAction,
    unlikePostAction,
    savePostAction,
    recordShareAction,
    purchasePostAction,
}                                                from "@/actions/fan/interactions"
import { recordPostViewAction }                  from "@/actions/fan/feed"
import "@/styles/fan/PostCard.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

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
        isLive?:     boolean
    }
}

type Props = {
    post:           Post
    userId:         string
    onUpdate:       (id: string, updates: Partial<Post>) => void
    compact?:       boolean
    onCommentOpen?: (id: string) => void
    onGiftOpen?:    (creatorId: string) => void
    onUnlockOpen?:  (post: Post) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const LOCK_LABEL: Record<string, string> = {
    FOLLOWERS_ONLY:   "Follow to unlock",
    SUBSCRIBERS_ONLY: "Subscribe to unlock",
    PLAN_SPECIFIC:    "Upgrade plan to unlock",
    TOP_FANS_ONLY:    "Top fans only",
}

// ── Photo carousel ────────────────────────────────────────────────────────────

const PhotoCarousel = ({ urls }: { urls: string[] }) => {
    const trackRef        = useRef<HTMLDivElement>(null)
    const [index, setIndex] = useState(0)

    // Single photo — natural aspect, no carousel chrome
    if (urls.length === 1) {
        return (
            <div className="post-card__frame">
                <img
                    src={urls[0]}
                    alt=""
                    className="post-card__frame-img"
                    loading="lazy"
                />
            </div>
        )
    }

    const onScroll = () => {
        const el = trackRef.current
        if (!el) return
        const i = Math.round(el.scrollLeft / el.clientWidth)
        if (i !== index) setIndex(i)
    }

    const goTo = (i: number) => {
        const el = trackRef.current
        if (!el) return
        el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" })
    }

    return (
        <div className="post-card__carousel">
            <div
                className="post-card__carousel-track"
                ref={trackRef}
                onScroll={onScroll}
            >
                {urls.map((url, i) => (
                    <div key={i} className="post-card__carousel-slide">
                        <img
                            src={url}
                            alt={`Photo ${i + 1} of ${urls.length}`}
                            loading={i === 0 ? "eager" : "lazy"}
                        />
                    </div>
                ))}
            </div>

            {/* 1/4 counter — top right */}
            <span className="post-card__carousel-count">
                {index + 1}/{urls.length}
            </span>

            {/* Desktop arrows */}
            {index > 0 && (
                <button
                    type="button"
                    className="post-card__carousel-arrow post-card__carousel-arrow--prev"
                    onClick={() => goTo(index - 1)}
                    aria-label="Previous photo"
                >
                    <ChevronLeft size={18} />
                </button>
            )}
            {index < urls.length - 1 && (
                <button
                    type="button"
                    className="post-card__carousel-arrow post-card__carousel-arrow--next"
                    onClick={() => goTo(index + 1)}
                    aria-label="Next photo"
                >
                    <ChevronRight size={18} />
                </button>
            )}

            {/* Dots */}
            <div className="post-card__carousel-dots" aria-hidden="true">
                {urls.map((_, i) => (
                    <span
                        key={i}
                        className={`post-card__carousel-dot ${i === index ? "post-card__carousel-dot--active" : ""}`}
                    />
                ))}
            </div>
        </div>
    )
}

// ── Custom audio player ───────────────────────────────────────────────────────

const AudioPlayer = ({ src }: { src: string }) => {
    const audioRef  = useRef<HTMLAudioElement>(null)
    const [playing,  setPlaying]  = useState(false)
    const [duration, setDuration] = useState(0)
    const [current,  setCurrent]  = useState(0)

    const fmt = (s: number) => {
        const m   = Math.floor(s / 60)
        const sec = Math.floor(s % 60)
        return `${m}:${String(sec).padStart(2, "0")}`
    }

    const toggle = () => {
        const a = audioRef.current
        if (!a) return
        if (playing) a.pause()
        else a.play().catch(() => {})
    }

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
        const a = audioRef.current
        if (!a || !duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        a.currentTime = ((e.clientX - rect.left) / rect.width) * duration
    }

    return (
        <div className="post-card__audio">
            <audio
                ref={audioRef}
                src={src}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            />

            <button
                type="button"
                className="post-card__audio-toggle"
                onClick={toggle}
                aria-label={playing ? "Pause audio" : "Play audio"}
            >
                {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div
                className="post-card__audio-track"
                onClick={seek}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={current}
            >
                <div
                    className="post-card__audio-fill"
                    style={{ width: `${duration ? (current / duration) * 100 : 0}%` }}
                />
            </div>

            <span className="post-card__audio-time">
                {fmt(current)}{duration ? ` / ${fmt(duration)}` : ""}
            </span>
        </div>
    )
}

// ── PostCard ──────────────────────────────────────────────────────────────────

export function PostCard({
    post, userId, onUpdate, compact = false,
    onCommentOpen, onGiftOpen, onUnlockOpen,
}: Props) {
    const [isPending,   startTransition] = useTransition()
    const [showShare,   setShowShare]    = useState(false)
    const [purchased,   setPurchased]    = useState(false)
    const [purchaseErr, setPurchaseErr]  = useState<string | null>(null)

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
    const isText   = !isVideo && !isAudio && !isPoll && !isPhoto
    const hasMedia = post.mediaUrls.length > 0
    const isLive   = post.creator.isLive === true

    // ── Poll totals ───────────────────────────────────────────────────────────
    const pollTotal: number = isPoll && post.poll
        ? post.poll.options.reduce((sum: number, o: any) => sum + (o.voteCount ?? 0), 0)
        : 0

    // ── Locked media zone ─────────────────────────────────────────────────────
    const renderLocked = () => (
        <div className={`post-card__locked ${isText || isPoll || isAudio ? "post-card__locked--flat" : ""}`}>
            {post.thumbnailUrl && (
                <img
                    src={post.thumbnailUrl}
                    alt=""
                    className="post-card__locked-blur"
                    aria-hidden="true"
                />
            )}
            <div className="post-card__locked-inner">
                <div className="post-card__locked-icon">
                    <Lock size={20} />
                </div>

                <p className="post-card__locked-label">
                    {LOCK_LABEL[post.lockReason ?? ""] ?? "Members only"}
                </p>
                <p className="post-card__locked-sub">
                    Join {post.creator.displayName}&rsquo;s community to see this
                </p>

                <div className="post-card__locked-actions">
                    <Link
                        href={`/profile/${post.creator.handle ?? post.creator.id}`}
                        className="post-card__locked-subscribe"
                    >
                        Subscribe
                    </Link>

                    {post.unlockPrice && !purchased && (
                        <button
                            type="button"
                            className="post-card__locked-purchase"
                            onClick={handlePurchase}
                            disabled={isPending}
                        >
                            Unlock for ₦{post.unlockPrice.toLocaleString()}
                        </button>
                    )}
                </div>

                {purchaseErr && (
                    <p className="post-card__locked-err">{purchaseErr}</p>
                )}
            </div>
        </div>
    )

    // ── Unlocked media zone ───────────────────────────────────────────────────
    const renderMedia = () => {
        if (isPhoto && hasMedia) {
            return <PhotoCarousel urls={post.mediaUrls} />
        }

        if (isVideo) {
            return (
                <div className="post-card__frame post-card__frame--video">
                    {hasMedia ? (
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
                                <img src={post.thumbnailUrl} alt="" className="post-card__frame-img" />
                            )}
                            <div className="post-card__play-icon"><Play size={28} /></div>
                        </div>
                    )}
                    {post.videoDuration ? (
                        <span className="post-card__video-duration">
                            {Math.floor(post.videoDuration / 60)}:
                            {String(post.videoDuration % 60).padStart(2, "0")}
                        </span>
                    ) : null}
                </div>
            )
        }

        if (isAudio && hasMedia) {
            return <AudioPlayer src={post.mediaUrls[0]} />
        }

        if (isPoll && post.poll) {
            return (
                <div className="post-card__poll">
                    <p className="post-card__poll-q">{post.poll.question}</p>
                    <div className="post-card__poll-options">
                        {post.poll.options.map((opt: any) => {
                            const pct = pollTotal > 0
                                ? Math.round(((opt.voteCount ?? 0) / pollTotal) * 100)
                                : 0
                            return (
                                <div key={opt.id} className="post-card__poll-option">
                                    <span
                                        className="post-card__poll-bar"
                                        style={{ width: `${pct}%` }}
                                        aria-hidden="true"
                                    />
                                    <span className="post-card__poll-text">{opt.text}</span>
                                    <span className="post-card__poll-pct">{pct}%</span>
                                </div>
                            )
                        })}
                    </div>
                    <span className="post-card__poll-total">
                        {formatCount(pollTotal)} {pollTotal === 1 ? "vote" : "votes"}
                    </span>
                </div>
            )
        }

        return null
    }

    return (
        <article
            className={`post-card ${compact ? "post-card--compact" : ""}`}
            onMouseEnter={handleView}
        >
            {/* ── Header: avatar · name · time ────────────────────────────── */}
            <header className="post-card__header">
                <Link
                    href={`/profile/${post.creator.handle ?? post.creator.id}`}
                    className="post-card__creator-link"
                >
                    <div className={`post-card__avatar ${isLive ? "post-card__avatar--live" : ""}`}>
                        {isLive && <span className="post-card__avatar-ring" />}
                        <div className="post-card__avatar-img-wrap">
                            {post.creator.image ? (
                                <img
                                    src={post.creator.image}
                                    alt={post.creator.displayName}
                                    width={40}
                                    height={40}
                                    className="post-card__avatar-img"
                                />
                            ) : (
                                <span className="post-card__avatar-fallback">
                                    {post.creator.displayName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {isLive && <span className="post-card__avatar-live-tag">LIVE</span>}
                    </div>

                    <div className="post-card__creator-meta">
                        <span className="post-card__creator-name">
                            {post.creator.displayName}
                            {post.creator.isVerified && (
                                <BadgeCheck size={14} className="post-card__verified" />
                            )}
                        </span>
                        <span className="post-card__creator-sub">
                            {post.creator.handle && <>@{post.creator.handle}</>}
                            <span className="post-card__dot">·</span>
                            {timeAgo(post.publishedAt ?? post.createdAt)}
                            {post.viewCount && post.viewCount > 0 ? (
                                <>
                                    <span className="post-card__dot">·</span>
                                    <span className="post-card__views">
                                        <Eye size={12} />
                                        {formatCount(post.viewCount)}
                                    </span>
                                </>
                            ) : null}
                        </span>
                    </div>
                </Link>
            </header>

            {/* ── Text posts: content is the body ─────────────────────────── */}
            {isText && post.hasAccess && (post.title || post.body) && (
                <div className="post-card__text">
                    {post.title && <h3 className="post-card__text-title">{post.title}</h3>}
                    {post.body  && <p className="post-card__text-body">{post.body}</p>}
                </div>
            )}

            {/* ── Media zone: edge-to-edge ────────────────────────────────── */}
            {!post.hasAccess ? renderLocked() : renderMedia()}

            {/* ── Action bar ──────────────────────────────────────────────── */}
            {!compact && (
                <div className="post-card__actions">
                    <div className="post-card__actions-left">
                        <button
                            type="button"
                            className={`post-card__action ${post.isLiked ? "post-card__action--liked" : ""}`}
                            onClick={handleLike}
                            disabled={isPending || !post.hasAccess}
                            aria-label={post.isLiked ? "Unlike" : "Like"}
                        >
                            <Heart size={22} fill={post.isLiked ? "currentColor" : "none"} />
                            {post.likeCount > 0 && <span>{formatCount(post.likeCount)}</span>}
                        </button>

                        <button
                            type="button"
                            className="post-card__action"
                            aria-label="Comment"
                            disabled={!post.hasAccess}
                            onClick={() => onCommentOpen?.(post.id)}
                        >
                            <MessageCircle size={22} />
                            {post.commentCount > 0 && <span>{formatCount(post.commentCount)}</span>}
                        </button>

                        <button
                            type="button"
                            className="post-card__action post-card__action--gift"
                            aria-label="Send gift"
                            onClick={() => onGiftOpen?.(post.creator.id)}
                        >
                            <Gift size={22} />
                        </button>

                        <button
                            type="button"
                            className="post-card__action"
                            onClick={handleShare}
                            aria-label="Share"
                        >
                            {showShare
                                ? <span className="post-card__copied">Copied!</span>
                                : <Share2 size={22} />
                            }
                        </button>
                    </div>

                    <button
                        type="button"
                        className={`post-card__action ${post.isSaved ? "post-card__action--saved" : ""}`}
                        onClick={handleSave}
                        disabled={isPending}
                        aria-label={post.isSaved ? "Unsave" : "Save"}
                    >
                        <Bookmark size={22} fill={post.isSaved ? "currentColor" : "none"} />
                    </button>
                </div>
            )}

            {/* ── Caption: title + body under actions (media posts only) ──── */}
            {!isText && post.hasAccess && (post.title || post.body) && (
                <div className="post-card__caption">
                    {post.title && (
                        <span className="post-card__caption-title">{post.title}</span>
                    )}
                    {post.body && (
                        <p className="post-card__caption-text">{post.body}</p>
                    )}
                </div>
            )}

            {/* ── Comments teaser ─────────────────────────────────────────── */}
            {!compact && post.hasAccess && post.commentCount > 0 && (
                <button
                    type="button"
                    className="post-card__comments-link"
                    onClick={() => onCommentOpen?.(post.id)}
                >
                    View all {formatCount(post.commentCount)} comments
                </button>
            )}
        </article>
    )
}