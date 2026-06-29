// components/fan/subscriptions/SubscriptionsClient.tsx
"use client"

import { useState, useTransition }          from "react"
import Image                                 from "next/image"
import Link                                  from "next/link"
import {
    BadgeCheck, Users, Calendar,
    ChevronDown, ChevronUp, Play,
    Mic, BarChart2, ImageIcon,
    Type, Loader2, X, CheckCircle,
    ShieldCheck,
}                                            from "lucide-react"
import {
    subscribeToPlanAction,
    cancelSubscriptionAction,
}                                            from "@/actions/fan/subscription"
import { Category }                          from "@prisma/client"
import "@/styles/fan/Subscriptions.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan = {
    id:       string
    name:     string
    price:    number
    interval: string
    benefits: string[]
}

type LatestPost = {
    id:            string
    type:          string
    title:         string | null
    body:          string | null
    thumbnailUrl:  string | null
    mediaUrls:     string[]
    likeCount:     number
    commentCount:  number
    publishedAt:   Date | string | null
    videoDuration: number | null
    accessLevel:   string
}

type Subscription = {
    id:         string
    status:     string
    startedAt:  Date | string
    expiresAt:  Date | string
    amountPaid: number
    plan:       Plan | null
    creator: {
        id:              string
        displayName:     string
        handle:          string | null
        isVerified:      boolean
        followersCount:  number
        subscribersCount: number
        image:           string | null
        latestPosts:     LatestPost[]
    }
}

type SuggestedCreator = {
    id:              string
    displayName:     string
    handle:          string | null
    isVerified:      boolean
    followersCount:  number
    subscribersCount: number
    bio:             string | null
    image:           string | null
    categories:      Category[]
    plans:           Plan[]
}

type Props = {
    initialSubscriptions: Subscription[]
    initialSuggested:     SuggestedCreator[]
    currentUserId:        string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-NG", {
        day:   "numeric",
        month: "short",
        year:  "numeric",
    })
}

function daysLeft(expiresAt: Date | string): number {
    return Math.max(0, Math.ceil(
        (new Date(expiresAt).getTime() - Date.now()) / 86_400_000
    ))
}

const POST_TYPE_ICON: Record<string, React.ReactNode> = {
    VIDEO: <Play      size={12} />,
    AUDIO: <Mic       size={12} />,
    POLL:  <BarChart2 size={12} />,
    PHOTO: <ImageIcon size={12} />,
    TEXT:  <Type      size={12} />,
}

// ── Post mini card ────────────────────────────────────────────────────────────

const PostMiniCard = ({ post }: { post: LatestPost }) => {
    const isLocked = post.accessLevel !== "PUBLIC"

    return (
        <Link href={`/p/${post.id}`} className="sub-post-card">
            <div className="sub-post-card__thumb">
                {post.thumbnailUrl || post.mediaUrls[0] ? (
                    <Image
                        src={post.thumbnailUrl ?? post.mediaUrls[0]}
                        alt={post.title ?? "Post"}
                        fill
                        sizes="120px"
                        className={`sub-post-card__img ${isLocked ? "sub-post-card__img--blur" : ""}`}
                    />
                ) : (
                    <div className="sub-post-card__placeholder">
                        {POST_TYPE_ICON[post.type]}
                    </div>
                )}
                <span className="sub-post-card__type">
                    {POST_TYPE_ICON[post.type]}
                </span>
            </div>
            <p className="sub-post-card__title">
                {post.title ?? post.body?.slice(0, 40) ?? "Untitled"}
            </p>
        </Link>
    )
}

// ── Cancel confirmation modal ─────────────────────────────────────────────────

const CancelModal = ({
    creatorName,
    onConfirm,
    onCancel,
    isPending,
}: {
    creatorName: string
    onConfirm:   () => void
    onCancel:    () => void
    isPending:   boolean
}) => (
    <>
        <div className="sub-cancel-backdrop" onClick={onCancel} aria-hidden="true" />
        <div className="sub-cancel-modal" role="dialog" aria-modal="true">
            <div className="sub-cancel-modal__handle" />
            <div className="sub-cancel-modal__body">
                <X size={28} className="sub-cancel-modal__icon" />
                <h3>Cancel subscription?</h3>
                <p>
                    You'll lose access to <strong>{creatorName}</strong>'s
                    exclusive content when your current period ends.
                </p>
                <div className="sub-cancel-modal__actions">
                    <button
                        type="button"
                        className="sub-cancel-btn sub-cancel-btn--confirm"
                        onClick={onConfirm}
                        disabled={isPending}
                    >
                        {isPending
                            ? <><Loader2 size={14} className="spin" /> Cancelling…</>
                            : "Yes, cancel"
                        }
                    </button>
                    <button
                        type="button"
                        className="sub-cancel-btn sub-cancel-btn--keep"
                        onClick={onCancel}
                        disabled={isPending}
                    >
                        Keep subscription
                    </button>
                </div>
            </div>
        </div>
    </>
)

// ── Plan picker modal ─────────────────────────────────────────────────────────

const PlanPickerModal = ({
    creator,
    onSelect,
    onCancel,
    isPending,
}: {
    creator:   SuggestedCreator
    onSelect:  (planId: string) => void
    onCancel:  () => void
    isPending: boolean
}) => (
    <>
        <div className="sub-cancel-backdrop" onClick={onCancel} aria-hidden="true" />
        <div className="sub-cancel-modal sub-plan-modal" role="dialog" aria-modal="true">
            <div className="sub-cancel-modal__handle" />
            <div className="sub-plan-modal__header">
                <div className="sub-plan-modal__creator">
                    {creator.image ? (
                        <Image
                            src={creator.image}
                            alt={creator.displayName}
                            width={40} height={40}
                            className="sub-plan-modal__avatar"
                        />
                    ) : (
                        <span className="sub-plan-modal__avatar-fallback">
                            {creator.displayName.charAt(0)}
                        </span>
                    )}
                    <div>
                        <p className="sub-plan-modal__name">{creator.displayName}</p>
                        {creator.handle && (
                            <p className="sub-plan-modal__handle">@{creator.handle}</p>
                        )}
                    </div>
                </div>
                <h3>Choose a plan</h3>
            </div>
            <div className="sub-plan-modal__plans">
                {creator.plans.map((plan) => (
                    <button
                        key={plan.id}
                        type="button"
                        className="sub-plan-option"
                        onClick={() => onSelect(plan.id)}
                        disabled={isPending}
                    >
                        <div className="sub-plan-option__top">
                            <span className="sub-plan-option__name">{plan.name}</span>
                            <span className="sub-plan-option__price">
                                ₦{plan.price.toLocaleString()}
                                <span>/{plan.interval === "yearly" ? "yr" : "mo"}</span>
                            </span>
                        </div>
                        {plan.benefits.length > 0 && (
                            <ul className="sub-plan-option__benefits">
                                {plan.benefits.slice(0, 3).map((b, i) => (
                                    <li key={i}>
                                        <CheckCircle size={11} />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </button>
                ))}
            </div>
        </div>
    </>
)

// ── Subscribed creator card ───────────────────────────────────────────────────

const SubscriptionCard = ({
    sub,
    onCancel,
}: {
    sub:      Subscription
    onCancel: (id: string, name: string) => void
}) => {
    const [expanded, setExpanded] = useState(false)
    const days = daysLeft(sub.expiresAt)
    const expiringSoon = days <= 7

    return (
        <div className="sub-card">
            {/* Creator row */}
            <div className="sub-card__header">
                <Link
                    href={`/profile/${sub.creator.handle ?? sub.creator.id}`}
                    className="sub-card__creator-link"
                >
                    <div className="sub-card__avatar">
                        {sub.creator.image ? (
                            <Image
                                src={sub.creator.image}
                                alt={sub.creator.displayName}
                                width={48} height={48}
                                className="sub-card__avatar-img"
                            />
                        ) : (
                            <span className="sub-card__avatar-fallback">
                                {sub.creator.displayName.charAt(0)}
                            </span>
                        )}
                    </div>
                    <div className="sub-card__creator-info">
                        <div className="sub-card__creator-name">
                            {sub.creator.displayName}
                            {sub.creator.isVerified && (
                                <BadgeCheck size={14} className="sub-card__verified" />
                            )}
                        </div>
                        {sub.creator.handle && (
                            <span className="sub-card__handle">@{sub.creator.handle}</span>
                        )}
                        <div className="sub-card__stats">
                            <span><Users size={11} /> {formatCount(sub.creator.subscribersCount)} subs</span>
                        </div>
                    </div>
                </Link>

                <div className="sub-card__right">
                    {sub.plan && (
                        <div className="sub-card__plan-badge">
                            {sub.plan.name}
                        </div>
                    )}
                    <button
                        type="button"
                        className="sub-card__expand"
                        onClick={() => setExpanded((v) => !v)}
                        aria-label={expanded ? "Collapse" : "Expand"}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Expiry */}
            <div className="sub-card__meta">
                <span className={`sub-card__expiry ${expiringSoon ? "sub-card__expiry--soon" : ""}`}>
                    <Calendar size={12} />
                    {expiringSoon
                        ? `Expires in ${days} day${days !== 1 ? "s" : ""}`
                        : `Active until ${formatDate(sub.expiresAt)}`
                    }
                </span>
                <span className="sub-card__price">
                    ₦{sub.plan?.price.toLocaleString() ?? sub.amountPaid.toLocaleString()}
                    /{sub.plan?.interval === "yearly" ? "yr" : "mo"}
                </span>
            </div>

            {/* Latest posts */}
            {sub.creator.latestPosts.length > 0 && (
                <div className="sub-card__posts">
                    {sub.creator.latestPosts.map((post) => (
                        <PostMiniCard key={post.id} post={post} />
                    ))}
                </div>
            )}

            {/* Expanded: plan benefits + cancel */}
            {expanded && (
                <div className="sub-card__expanded">
                    {sub.plan && sub.plan.benefits.length > 0 && (
                        <div className="sub-card__benefits">
                            <p className="sub-card__benefits-label">Your plan includes</p>
                            <ul>
                                {sub.plan.benefits.map((b, i) => (
                                    <li key={i}>
                                        <CheckCircle size={12} />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <button
                        type="button"
                        className="sub-card__cancel"
                        onClick={() => onCancel(sub.id, sub.creator.displayName)}
                    >
                        Cancel subscription
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Suggested creator card ────────────────────────────────────────────────────

const SuggestedCard = ({
    creator,
    onSubscribe,
}: {
    creator:     SuggestedCreator
    onSubscribe: (creator: SuggestedCreator) => void
}) => (
    <div className="suggested-card">
        <Link href={`/profile/${creator.handle ?? creator.id}`} className="suggested-card__creator">
            <div className="suggested-card__avatar">
                {creator.image ? (
                    <Image
                        src={creator.image}
                        alt={creator.displayName}
                        width={44} height={44}
                        className="suggested-card__avatar-img"
                    />
                ) : (
                    <span className="suggested-card__avatar-fallback">
                        {creator.displayName.charAt(0)}
                    </span>
                )}
            </div>
            <div className="suggested-card__info">
                <div className="suggested-card__name">
                    {creator.displayName}
                    {creator.isVerified && <ShieldCheck size={13} className="suggested-card__verified" />}
                </div>
                {creator.handle && (
                    <span className="suggested-card__handle">@{creator.handle}</span>
                )}
                <div className="suggested-card__stats">
                    <span><Users size={11} /> {formatCount(creator.followersCount)} followers</span>
                </div>
            </div>
        </Link>

        {creator.bio && (
            <p className="suggested-card__bio">{creator.bio}</p>
        )}

        {creator.plans.length > 0 ? (
            <div className="suggested-card__plans">
                <span className="suggested-card__from">
                    from ₦{Math.min(...creator.plans.map((p) => p.price)).toLocaleString()}/mo
                </span>
                <button
                    type="button"
                    className="suggested-card__subscribe"
                    onClick={() => onSubscribe(creator)}
                >
                    Subscribe
                </button>
            </div>
        ) : (
            <p className="suggested-card__no-plans">No subscription plans yet</p>
        )}
    </div>
)

// ── SubscriptionsClient ───────────────────────────────────────────────────────

export const SubscriptionsClient = ({
    initialSubscriptions,
    initialSuggested,
}: Props) => {
    const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
    const [suggested,     setSuggested]     = useState(initialSuggested)

    // Cancel flow
    const [cancelTarget,  setCancelTarget]  = useState<{ id: string; name: string } | null>(null)
    const [cancelling,    startCancel]      = useTransition()

    // Subscribe flow
    const [planTarget,    setPlanTarget]    = useState<SuggestedCreator | null>(null)
    const [subscribing,   startSubscribe]   = useTransition()

    const [toast, setToast] = useState<string | null>(null)

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    // ── Cancel ────────────────────────────────────────────────────────────────
    const handleCancelConfirm = () => {
        if (!cancelTarget) return
        startCancel(async () => {
            const res = await cancelSubscriptionAction(cancelTarget.id)
            if (res?.success) {
                setSubscriptions((prev) => prev.filter((s) => s.id !== cancelTarget.id))
                showToast("Subscription cancelled.")
            } else {
                showToast(res?.error ?? "Failed to cancel.")
            }
            setCancelTarget(null)
        })
    }

    // ── Subscribe ─────────────────────────────────────────────────────────────
    const handlePlanSelect = (planId: string) => {
        if (!planTarget) return
        const creatorId = planTarget.id

        startSubscribe(async () => {
            const res = await subscribeToPlanAction({ creatorId, planId })

            if (res?.error === "INSUFFICIENT_FUNDS") {
                showToast(`Insufficient funds. Top up your wallet to subscribe.`)
                setPlanTarget(null)
                return
            }

            if (res?.error) {
                showToast(res.error)
                setPlanTarget(null)
                return
            }

            if (res?.success) {
                // Remove from suggested
                setSuggested((prev) => prev.filter((c) => c.id !== creatorId))
                showToast(`Subscribed to ${planTarget.displayName}!`)
                setPlanTarget(null)
            }
        })
    }

    const hasSubscriptions = subscriptions.length > 0

    return (
        <div className="subscriptions-page">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="subscriptions-page__header">
                <h1>Subscriptions</h1>
                {hasSubscriptions && (
                    <span className="subscriptions-page__count">
                        {subscriptions.length} active
                    </span>
                )}
            </div>

            {/* ── Active subscriptions ────────────────────────────────────────── */}
            {hasSubscriptions ? (
                <section className="subscriptions-page__section">
                    <div className="subscriptions-list">
                        {subscriptions.map((sub) => (
                            <SubscriptionCard
                                key={sub.id}
                                sub={sub}
                                onCancel={(id, name) => setCancelTarget({ id, name })}
                            />
                        ))}
                    </div>
                </section>
            ) : (
                <section className="subscriptions-page__empty">
                    <div className="subscriptions-empty">
                        <div className="subscriptions-empty__icon">💎</div>
                        <h2>No subscriptions yet</h2>
                        <p>
                            Subscribe to creators to unlock exclusive content,
                            direct messaging, and more.
                        </p>
                    </div>
                </section>
            )}

            {/* ── Suggested creators (followed but not subscribed) ─────────────── */}
            {suggested.length > 0 && (
                <section className="subscriptions-page__section">
                    <div className="subscriptions-page__section-header">
                        <h2>{hasSubscriptions ? "More creators you follow" : "Creators you follow"}</h2>
                        <p>Subscribe to unlock their exclusive content</p>
                    </div>
                    <div className="suggested-list">
                        {suggested.map((creator) => (
                            <SuggestedCard
                                key={creator.id}
                                creator={creator}
                                onSubscribe={(c) => setPlanTarget(c)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* ── Cancel modal ─────────────────────────────────────────────────── */}
            {cancelTarget && (
                <CancelModal
                    creatorName={cancelTarget.name}
                    onConfirm={handleCancelConfirm}
                    onCancel={() => setCancelTarget(null)}
                    isPending={cancelling}
                />
            )}

            {/* ── Plan picker modal ─────────────────────────────────────────────── */}
            {planTarget && (
                <PlanPickerModal
                    creator={planTarget}
                    onSelect={handlePlanSelect}
                    onCancel={() => setPlanTarget(null)}
                    isPending={subscribing}
                />
            )}

            {/* ── Toast ────────────────────────────────────────────────────────── */}
            {toast && <div className="subscriptions-toast">{toast}</div>}

        </div>
    )
}