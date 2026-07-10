// components/fan/feed/ShortsPlayer.tsx
"use client"

import {
    useState, useRef, useEffect,
    useCallback, useTransition,
} from "react"
import Link                   from "next/link"
import { useRouter }          from "next/navigation"
import {
    Heart, MessageCircle, Share2,
    Bookmark, Gift, Volume2, VolumeX,
    Lock, ShoppingBag, ChevronUp, ChevronDown,
} from "lucide-react"
import {
    likePostAction, unlikePostAction,
    savePostAction, recordShareAction,
} from "@/actions/fan/interactions"
import { getShortsAction } from "@/actions/fan/feed"
import { CommentPanel }    from "./CommentPanel"
import { GiftPanel }       from "./GiftPanel"
import "@/styles/fan/Shorts.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

// Derive Short directly from the server action so the local type and the
// action return type can never drift apart. Any extra fields the action
// returns (type, publishedAt, etc.) are included automatically.
type ActionShort = Awaited<ReturnType<typeof getShortsAction>>["shorts"][number]

type Short = ActionShort & {
    // isLive is joined on the server but not in the base action return type
    creator: ActionShort["creator"] & { isLive?: boolean }
}

type Props = {
    initialShorts: Short[]
    startIndex:    number
    currentUserId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

/** Profile route — must match PostCard / FeedRightRail / LiveRail. */
const profileHref = (creator: { handle: string | null; id: string }) =>
    `/fan/${creator.handle ?? creator.id}`

// ── Single short item ─────────────────────────────────────────────────────────

type ShortItemProps = {
    short:     Short
    isActive:  boolean
    isMuted:   boolean
    onLike:    () => void
    onSave:    () => void
    onShare:   () => void
    onComment: () => void
    onGift:    () => void
    onUnlock:  () => void
    onPrev:    () => void
    onNext:    () => void
    hasNext:   boolean
    hasPrev:   boolean
}

const ShortItem = ({
    short, isActive, isMuted,
    onLike, onSave, onShare, onComment, onGift, onUnlock,
    onPrev, onNext, hasNext, hasPrev,
}: ShortItemProps) => {
    const videoRef = useRef<HTMLVideoElement>(null)

    // Play/pause based on active state
    useEffect(() => {
        const vid = videoRef.current
        if (!vid) return
        if (isActive && short.hasAccess && short.mediaUrls[0]) {
            vid.currentTime = 0
            vid.play().catch(() => {})
        } else {
            vid.pause()
        }
    }, [isActive, short.hasAccess, short.mediaUrls])

    // Sync mute
    useEffect(() => {
        if (videoRef.current) videoRef.current.muted = isMuted
    }, [isMuted])

    const lockLabel =
        short.lockReason === "FOLLOWERS_ONLY"   ? "Follow to unlock"    :
        short.lockReason === "SUBSCRIBERS_ONLY" ? "Subscribe to unlock" :
        short.lockReason === "PLAN_SPECIFIC"    ? "Upgrade plan"        :
        "Members only"

    return (
        <div className="short-item">

            {/* Video / locked thumbnail */}
            {short.hasAccess && short.mediaUrls[0] ? (
                <video
                    ref={videoRef}
                    className="short-item__video"
                    src={short.mediaUrls[0]}
                    loop
                    playsInline
                    muted={isMuted}
                    poster={short.thumbnailUrl ?? undefined}
                    preload={isActive ? "auto" : "none"}
                />
            ) : (
                <div className="short-item__locked-bg">
                    {short.thumbnailUrl && (
                        <img
                            src={short.thumbnailUrl}
                            alt={short.title ?? ""}
                            className="short-item__thumb-blur"
                        />
                    )}
                    <div className="short-item__locked-overlay">
                        <Lock size={28} />
                        <p>{lockLabel}</p>
                        <div className="short-item__locked-actions">
                            <Link
                                href={profileHref(short.creator)}
                                className="short-locked-btn short-locked-btn--primary"
                            >
                                {short.lockReason === "FOLLOWERS_ONLY" ? "Follow" : "Subscribe"}
                            </Link>
                            {short.unlockPrice && short.unlockPrice > 0 && (
                                <button
                                    type="button"
                                    className="short-locked-btn short-locked-btn--secondary"
                                    onClick={onUnlock}
                                >
                                    <ShoppingBag size={13} />
                                    ₦{short.unlockPrice.toLocaleString()}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom overlay — creator info + caption */}
            <div className="short-item__info">
                <Link href={profileHref(short.creator)} className="short-item__creator">
                    <div className={`short-avatar ${short.creator.isLive ? "short-avatar--live" : ""}`}>
                        {short.creator.isLive && (
                            <>
                                <span className="short-avatar__ring short-avatar__ring--1" />
                                <span className="short-avatar__ring short-avatar__ring--2" />
                            </>
                        )}
                        <div className="short-avatar__img-wrap">
                            {short.creator.image ? (
                                <img
                                    src={short.creator.image}
                                    alt={short.creator.displayName}
                                    width={42} height={42}
                                    className="short-avatar__img"
                                />
                            ) : (
                                <span className="short-avatar__fallback">
                                    {short.creator.displayName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {short.creator.isLive && (
                            <span className="short-avatar__live-tag">LIVE</span>
                        )}
                    </div>

                    <div className="short-item__creator-meta">
                        <span className="short-item__creator-name">
                            {short.creator.displayName}
                            {short.creator.isVerified && (
                                <span className="short-item__verified">✓</span>
                            )}
                        </span>
                        {short.creator.handle && (
                            <span className="short-item__creator-handle">
                                @{short.creator.handle}
                            </span>
                        )}
                    </div>
                </Link>

                {/* Caption */}
                {(short.title || short.body) && (
                    <p className="short-item__caption">
                        {short.title ?? short.body}
                    </p>
                )}
            </div>

            {/* Right action rail */}
            <div className="short-item__actions">
                <button
                    type="button"
                    className={`short-action ${short.isLiked ? "short-action--liked" : ""}`}
                    onClick={onLike}
                    aria-label={short.isLiked ? "Unlike" : "Like"}
                >
                    <Heart size={28} fill={short.isLiked ? "currentColor" : "none"} />
                    <span>{fmtCount(short.likeCount)}</span>
                </button>

                <button
                    type="button"
                    className="short-action"
                    onClick={onComment}
                    aria-label="Comment"
                >
                    <MessageCircle size={28} />
                    <span>{fmtCount(short.commentCount)}</span>
                </button>

                <button
                    type="button"
                    className="short-action"
                    onClick={onShare}
                    aria-label="Share"
                >
                    <Share2 size={28} />
                </button>

                <button
                    type="button"
                    className={`short-action ${short.isSaved ? "short-action--saved" : ""}`}
                    onClick={onSave}
                    aria-label={short.isSaved ? "Unsave" : "Save"}
                >
                    <Bookmark size={28} fill={short.isSaved ? "currentColor" : "none"} />
                </button>

                <button
                    type="button"
                    className="short-action short-action--gift"
                    onClick={onGift}
                    aria-label="Gift"
                >
                    <Gift size={28} />
                </button>
            </div>

            {/* Prev / Next nav arrows (desktop) */}
            {hasPrev && (
                <button
                    type="button"
                    className="short-nav short-nav--prev"
                    onClick={onPrev}
                    aria-label="Previous short"
                >
                    <ChevronUp size={24} />
                </button>
            )}
            {hasNext && (
                <button
                    type="button"
                    className="short-nav short-nav--next"
                    onClick={onNext}
                    aria-label="Next short"
                >
                    <ChevronDown size={24} />
                </button>
            )}
        </div>
    )
}

// ── ShortsPlayer ──────────────────────────────────────────────────────────────

export const ShortsPlayer = ({ initialShorts, startIndex, currentUserId }: Props) => {
    const router = useRouter()

    const [shorts,  setShorts]  = useState<Short[]>(initialShorts)
    const [index,   setIndex]   = useState(startIndex)
    const [isMuted, setIsMuted] = useState(true)
    const [loading, setLoading] = useState(false)
    const [,        startTransition] = useTransition()

    // Panels
    const [commentPostId, setCommentPostId] = useState<string | null>(null)
    const [giftCreatorId, setGiftCreatorId] = useState<string | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const touchStartY  = useRef<number>(0)
    const isSwiping    = useRef(false)

    const current = shorts[index]

    // ── URL sync ──────────────────────────────────────────────────────────────
    // Must match the real route: app/(fan)/fan/shorts/[id]/page.tsx
    useEffect(() => {
        if (!current) return
        router.replace(`/fan/shorts/${current.id}`, { scroll: false })
    }, [current?.id])

    // ── Load more when near end ───────────────────────────────────────────────
    useEffect(() => {
        if (index >= shorts.length - 3 && !loading) {
            setLoading(true)
            startTransition(async () => {
                const nextPage = Math.ceil(shorts.length / 10) + 1
                const data = await getShortsAction({ page: nextPage, limit: 10 })
                if (data.shorts.length > 0) {
                    setShorts((prev) => {
                        const ids   = new Set(prev.map((s) => s.id))
                        // Cast is safe: ActionShort satisfies Short (isLive is optional)
                        const fresh = data.shorts.filter((s) => !ids.has(s.id)) as Short[]
                        return [...prev, ...fresh]
                    })
                }
                setLoading(false)
            })
        }
    }, [index, shorts.length, loading])

    // ── Navigate ──────────────────────────────────────────────────────────────
    const goTo = useCallback((next: number) => {
        if (next < 0 || next >= shorts.length) return
        setIndex(next)
    }, [shorts.length])

    const goNext = useCallback(() => goTo(index + 1), [goTo, index])
    const goPrev = useCallback(() => goTo(index - 1), [goTo, index])

    // ── Touch swipe ───────────────────────────────────────────────────────────
    const onTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY
        isSwiping.current   = false
    }
    const onTouchMove = (e: React.TouchEvent) => {
        const delta = touchStartY.current - e.touches[0].clientY
        if (Math.abs(delta) > 10) isSwiping.current = true
    }
    const onTouchEnd = (e: React.TouchEvent) => {
        if (!isSwiping.current) return
        const delta = touchStartY.current - e.changedTouches[0].clientY
        if (delta > 50)  goNext()
        if (delta < -50) goPrev()
    }

    // ── Keyboard navigation ───────────────────────────────────────────────────
    // Disabled while a panel is open, otherwise arrow keys scrub shorts behind it.
    const panelOpen = commentPostId !== null || giftCreatorId !== null

    useEffect(() => {
        if (panelOpen) return

        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown")          goNext()
            if (e.key === "ArrowUp")            goPrev()
            if (e.key === "m" || e.key === "M") setIsMuted((m) => !m)
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [goNext, goPrev, panelOpen])

    // ── Optimistic interaction handlers ───────────────────────────────────────
    const mutateShort = (id: string, patch: Partial<Short>) =>
        setShorts((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s))

    const handleLike = (s: Short) => {
        const next = !s.isLiked
        mutateShort(s.id, { isLiked: next, likeCount: s.likeCount + (next ? 1 : -1) })
        startTransition(async () => {
            const res = next ? await likePostAction(s.id) : await unlikePostAction(s.id)
            if (!res?.success) {
                mutateShort(s.id, { isLiked: !next, likeCount: s.likeCount + (next ? -1 : 1) })
            }
        })
    }

    const handleSave = (s: Short) => {
        mutateShort(s.id, { isSaved: !s.isSaved })
        startTransition(async () => { await savePostAction(s.id) })
    }

    const handleShare = async (s: Short) => {
        const url = `${window.location.origin}/fan/shorts/${s.id}`
        try {
            if (navigator.share) await navigator.share({ title: s.title ?? "Check this short on NESORA", url })
            else await navigator.clipboard.writeText(url)
        } catch {}
        await recordShareAction(s.id)
    }

    if (!current) return null

    return (
        <div
            className="shorts-player"
            ref={containerRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            {/* Mute toggle */}
            <button
                type="button"
                className="shorts-player__mute"
                onClick={() => setIsMuted((m) => !m)}
                aria-label={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>

            {/* Current short */}
            <ShortItem
                key={current.id}
                short={current}
                isActive={!panelOpen}
                isMuted={isMuted}
                onLike={()    => handleLike(current)}
                onSave={()    => handleSave(current)}
                onShare={()   => handleShare(current)}
                onComment={() => setCommentPostId(current.id)}
                onGift={()    => setGiftCreatorId(current.creator.id)}
                onUnlock={()  => setGiftCreatorId(current.creator.id)}
                onNext={goNext}
                onPrev={goPrev}
                hasNext={index < shorts.length - 1}
                hasPrev={index > 0}
            />

            {/* Progress dots */}
            {shorts.length > 1 && (
                <div className="shorts-player__dots" aria-hidden="true">
                    {shorts.slice(Math.max(0, index - 2), index + 5).map((s, i) => {
                        const actualIndex = Math.max(0, index - 2) + i
                        return (
                            <span
                                key={s.id}
                                className={`shorts-dot ${actualIndex === index ? "shorts-dot--active" : ""}`}
                            />
                        )
                    })}
                </div>
            )}

            {/* ── Comments ── */}
            {commentPostId && (
                <CommentPanel
                    postId={commentPostId}
                    currentUserId={currentUserId}
                    onClose={() => setCommentPostId(null)}
                    onCommentAdded={() => {
                        mutateShort(commentPostId, {
                            commentCount: (shorts.find((s) => s.id === commentPostId)?.commentCount ?? 0) + 1,
                        } as Partial<Short>)
                    }}
                />
            )}

            {/* ── Gift ── */}
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