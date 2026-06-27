"use client"

import { useState, useEffect }        from "react"
import Image                           from "next/image"
import {
    Search, Send, Loader2, CheckCircle2,
    Clock, XCircle, MessageSquarePlus,
    MessageCircle, Star, ArrowLeft,
    Crown,
} from "lucide-react"
import {
    getFollowedCreatorsAction,
    startConversationAction,
    sendMessageRequestAction,
    getFanMessageRequestsAction,
} from "@/actions/fan/messages"
import { formatDistanceToNow }         from "date-fns"
import "@/styles/fan/messages/FanMessageRequest.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type SubscriptionInfo = {
    planName:  string | null
    planPrice: number | null
    interval:  string | null
    startedAt: Date
    expiresAt: Date
}

type FollowedCreator = {
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
    isSubscribed:      boolean
    subscription:      SubscriptionInfo | null
    conversationId:    string | null
    hasPendingRequest: boolean
}

type SentRequest = {
    id:        string
    message:   string
    status:    "PENDING" | "ACCEPTED" | "DECLINED"
    createdAt: Date
    toCreator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
}

type Props = {
    onOpenConversation: (conversationId: string) => void
    onRequestSent?:     () => void
}

// ── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: SentRequest["status"] }) => {
    const map = {
        PENDING:  { icon: <Clock        size={12} />, label: "Pending",  cls: "pending"  },
        ACCEPTED: { icon: <CheckCircle2 size={12} />, label: "Accepted", cls: "accepted" },
        DECLINED: { icon: <XCircle      size={12} />, label: "Declined", cls: "declined" },
    }
    const { icon, label, cls } = map[status]
    return (
        <span className={`fan-req-status fan-req-status--${cls}`}>
            {icon} {label}
        </span>
    )
}

// ── Subscription tier label ───────────────────────────────────────────────────

const SubscriptionBadge = ({ subscription }: { subscription: SubscriptionInfo }) => {
    const label = subscription.planName ?? "Subscriber"
    const price = subscription.planPrice
        ? `\u20A6${subscription.planPrice.toLocaleString()}/${subscription.interval === "yearly" ? "yr" : "mo"}`
        : null

    return (
        <span className="fan-creator-card__tier">
            <Crown size={10} />
            <span>{label}</span>
            {price && <span className="fan-creator-card__tier-price">{price}</span>}
        </span>
    )
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FanMessageRequest = ({
    onOpenConversation,
    onRequestSent,
}: Props) => {
    const [creators,  setCreators]  = useState<FollowedCreator[]>([])
    const [requests,  setRequests]  = useState<SentRequest[]>([])
    const [loading,   setLoading]   = useState(true)
    const [search,    setSearch]    = useState("")

    // Compose state
    const [composingFor, setComposingFor] = useState<FollowedCreator | null>(null)
    const [message,      setMessage]      = useState("")
    const [sending,      setSending]      = useState(false)
    const [error,        setError]        = useState<string | null>(null)
    const [success,      setSuccess]      = useState(false)

    // Starting conversation loading
    const [startingId, setStartingId] = useState<string | null>(null)

    // ── Load data ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const [creatorData, requestData] = await Promise.all([
                    getFollowedCreatorsAction(),
                    getFanMessageRequestsAction(),
                ])
                setCreators(creatorData)
                setRequests(requestData as SentRequest[])
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [success])

    // ── Filter creators ───────────────────────────────────────────────────────
    const filtered = creators.filter((f) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
            f.creator.displayName.toLowerCase().includes(q) ||
            f.creator.handle?.toLowerCase().includes(q)
        )
    })

    // Subscribers first, then non-subscribers, alphabetical within each group
    const sorted = [...filtered].sort((a, b) => {
        if (a.isSubscribed && !b.isSubscribed) return -1
        if (!a.isSubscribed && b.isSubscribed) return 1
        return a.creator.displayName.localeCompare(b.creator.displayName)
    })

    // Split into groups for section headers
    const subscribedCreators = sorted.filter((c) => c.isSubscribed)
    const followingOnly      = sorted.filter((c) => !c.isSubscribed)

    // ── Message subscriber directly ───────────────────────────────────────────
    const handleMessageDirect = async (creatorId: string, existingConvId: string | null) => {
        if (existingConvId) {
            onOpenConversation(existingConvId)
            return
        }

        setStartingId(creatorId)
        try {
            const res = await startConversationAction(creatorId)
            if (res.error) {
                setError(res.error)
            } else if (res.conversationId) {
                onOpenConversation(res.conversationId)
                onRequestSent?.()
            }
        } finally {
            setStartingId(null)
        }
    }

    // ── Send message request ──────────────────────────────────────────────────
    const handleSendRequest = async () => {
        if (!composingFor || !message.trim()) return

        setError(null)
        setSending(true)
        try {
            const res = await sendMessageRequestAction({
                creatorId: composingFor.creator.id,
                message:   message.trim(),
            })
            if (res.error) {
                setError(res.error)
            } else {
                setSuccess(true)
                setMessage("")
                setComposingFor(null)
                onRequestSent?.()
            }
        } catch {
            setError("Something went wrong. Please try again.")
        } finally {
            setSending(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendRequest()
        }
    }

    // ── Creator card renderer ─────────────────────────────────────────────────
    const renderCreatorCard = (item: FollowedCreator) => {
        const { creator, isSubscribed, subscription, conversationId, hasPendingRequest } = item
        const isStarting = startingId === creator.id

        return (
            <div key={creator.id} className="fan-creator-card">
                <div className="fan-creator-card__left">
                    <div className="fan-creator-card__avatar">
                        {creator.user.image ? (
                            <Image
                                src={creator.user.image}
                                alt={creator.displayName}
                                width={40}
                                height={40}
                            />
                        ) : (
                            <span>
                                {creator.displayName.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="fan-creator-card__info">
                        <div className="fan-creator-card__name-row">
                            <span className="fan-creator-card__name">
                                {creator.displayName}
                            </span>
                        </div>
                        {creator.handle && (
                            <span className="fan-creator-card__handle">
                                @{creator.handle}
                            </span>
                        )}
                        {isSubscribed && subscription && (
                            <SubscriptionBadge subscription={subscription} />
                        )}
                    </div>
                </div>

                <div className="fan-creator-card__action">
                    {conversationId ? (
                        <button
                            className="fan-creator-card__btn fan-creator-card__btn--open"
                            onClick={() => onOpenConversation(conversationId)}
                        >
                            <MessageCircle size={14} />
                            Open
                        </button>
                    ) : isSubscribed ? (
                        <button
                            className="fan-creator-card__btn fan-creator-card__btn--message"
                            onClick={() => handleMessageDirect(creator.id, null)}
                            disabled={isStarting}
                        >
                            {isStarting ? (
                                <Loader2 size={14} className="spin" />
                            ) : (
                                <>
                                    <MessageCircle size={14} />
                                    Message
                                </>
                            )}
                        </button>
                    ) : hasPendingRequest ? (
                        <span className="fan-req-status fan-req-status--pending">
                            <Clock size={12} /> Pending
                        </span>
                    ) : (
                        <button
                            className="fan-creator-card__btn fan-creator-card__btn--request"
                            onClick={() => {
                                setComposingFor(item)
                                setSuccess(false)
                                setError(null)
                                setMessage("")
                            }}
                        >
                            <Send size={14} />
                            Request
                        </button>
                    )}
                </div>
            </div>
        )
    }

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="fan-msg-request__loading">
                <Loader2 size={20} className="spin" />
            </div>
        )
    }

    // ── Compose view (for non-subscribers) ────────────────────────────────────
    if (composingFor) {
        return (
            <div className="fan-msg-request">
                <div className="fan-msg-request__compose">
                    <button
                        className="fan-msg-request__back-btn"
                        onClick={() => {
                            setComposingFor(null)
                            setMessage("")
                            setError(null)
                        }}
                    >
                        <ArrowLeft size={16} />
                        Back to creators
                    </button>

                    <div className="fan-msg-request__header">
                        <MessageSquarePlus size={20} />
                        <h3>Send a message request</h3>
                    </div>

                    <div className="fan-msg-request__creator-preview">
                        <div className="fan-msg-request__creator-avatar">
                            {composingFor.creator.user.image ? (
                                <Image
                                    src={composingFor.creator.user.image}
                                    alt={composingFor.creator.displayName}
                                    width={40}
                                    height={40}
                                />
                            ) : (
                                <span>
                                    {composingFor.creator.displayName.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <div>
                            <p className="fan-msg-request__creator-name">
                                {composingFor.creator.displayName}
                            </p>
                            {composingFor.creator.handle && (
                                <p className="fan-msg-request__creator-handle">
                                    @{composingFor.creator.handle}
                                </p>
                            )}
                        </div>
                    </div>

                    {success ? (
                        <div className="fan-msg-request__success">
                            <CheckCircle2 size={24} />
                            <p>Request sent!</p>
                            <span>
                                You'll be notified when {composingFor.creator.displayName} responds.
                            </span>
                        </div>
                    ) : (
                        <>
                            <div className="fan-msg-request__input-wrap">
                                <textarea
                                    className="fan-msg-request__input"
                                    placeholder="Write your message..."
                                    value={message}
                                    onChange={(e) => {
                                        setMessage(e.target.value)
                                        setError(null)
                                    }}
                                    onKeyDown={handleKeyDown}
                                    rows={3}
                                    maxLength={500}
                                    disabled={sending}
                                />
                                <span className="fan-msg-request__char-count">
                                    {message.length}/500
                                </span>
                            </div>

                            {error && (
                                <p className="fan-msg-request__error">{error}</p>
                            )}

                            <button
                                className="fan-msg-request__send-btn"
                                onClick={handleSendRequest}
                                disabled={!message.trim() || sending}
                            >
                                {sending ? (
                                    <>
                                        <Loader2 size={16} className="spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={16} />
                                        Send Request
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ── Main view: creator list (grouped) + request history ───────────────────
    return (
        <div className="fan-msg-request">

            {/* ── Creator list ── */}
            <div className="fan-msg-request__section">
                <div className="fan-msg-request__section-header">
                    <MessageSquarePlus size={20} />
                    <h3>New message</h3>
                </div>

                {/* Search */}
                <div className="fan-msg-request__search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search creators you follow..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {error && (
                    <p className="fan-msg-request__error">{error}</p>
                )}

                {sorted.length === 0 ? (
                    <div className="fan-msg-request__empty">
                        {search.trim() ? (
                            <p>No creators match "{search}"</p>
                        ) : (
                            <>
                                <p>You're not following any creators yet</p>
                                <span>Follow creators to start messaging them</span>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="fan-msg-request__creator-list">
                        {/* Subscribed creators — direct message access */}
                        {subscribedCreators.length > 0 && (
                            <>
                                <div className="fan-msg-request__group-label">
                                    <Star size={14} />
                                    <span>Subscriptions — Direct message</span>
                                </div>
                                {subscribedCreators.map(renderCreatorCard)}
                            </>
                        )}

                        {/* Following only — must send request */}
                        {followingOnly.length > 0 && (
                            <>
                                <div className="fan-msg-request__group-label">
                                    <span>Following — Send a request</span>
                                </div>
                                {followingOnly.map(renderCreatorCard)}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Sent requests history ── */}
            {requests.length > 0 && (
                <div className="fan-msg-request__section">
                    <h3 className="fan-msg-request__section-title">
                        Your message requests
                    </h3>

                    <div className="fan-msg-request__req-list">
                        {requests.map((req) => (
                            <div key={req.id} className="fan-req-card">
                                <div className="fan-req-card__top">
                                    <div className="fan-req-card__creator">
                                        <div className="fan-req-card__avatar">
                                            {req.toCreator.user.image ? (
                                                <Image
                                                    src={req.toCreator.user.image}
                                                    alt={req.toCreator.displayName}
                                                    width={32}
                                                    height={32}
                                                />
                                            ) : (
                                                <span>
                                                    {req.toCreator.displayName.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="fan-req-card__name">
                                                {req.toCreator.displayName}
                                            </p>
                                            {req.toCreator.handle && (
                                                <p className="fan-req-card__handle">
                                                    @{req.toCreator.handle}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <StatusBadge status={req.status} />
                                </div>

                                <p className="fan-req-card__message">{req.message}</p>

                                <span className="fan-req-card__time">
                                    {formatDistanceToNow(
                                        new Date(req.createdAt),
                                        { addSuffix: true }
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
