// component/calls/CallHistory.tsx
"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import Image    from "next/image"
import Link     from "next/link"
import {
    Phone, Video, PhoneMissed, PhoneOff,
    Clock, Banknote, Loader2, MessageCircle,
    PhoneCall, Star,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import {
    getCallHistoryAction,
    type CallHistoryItem,
    type CallHistoryFilter,
    type CallHistoryPerspective,
    type CallHistoryResult,
} from "@/actions/calls/get-call-history"
import "@/styles/calls/CallHistory.scss"

type Props = {
    perspective: CallHistoryPerspective
}

const conversationHref = (perspective: CallHistoryPerspective, conversationId: string) =>
    perspective === "creator"
        ? `/creator/messages/${conversationId}`
        : `/messages/${conversationId}`

const outcomeMeta = (call: CallHistoryItem, perspective: CallHistoryPerspective) => {
    switch (call.status) {
        case "ENDED":
            return {
                icon:  call.type === "VOICE" ? <Phone size={16} /> : <Video size={16} />,
                label: perspective === "fan" ? "Outgoing" : "Incoming",
                cls:   "ended",
            }
        case "MISSED":
            return {
                icon:  <PhoneMissed size={16} />,
                label: perspective === "fan" ? "No answer" : "Missed",
                cls:   "missed",
            }
        case "DECLINED":
            return {
                icon:  <PhoneOff size={16} />,
                label: "Declined",
                cls:   "declined",
            }
        case "IN_PROGRESS":
            return {
                icon:  <PhoneCall size={16} />,
                label: "Ongoing",
                cls:   "ongoing",
            }
        default:
            return {
                icon:  <PhoneOff size={16} />,
                label: "Failed",
                cls:   "failed",
            }
    }
}

export const CallHistory = ({ perspective }: Props) => {

    const [calls,     setCalls]     = useState<CallHistoryItem[]>([])
    const [stats,     setStats]     = useState<CallHistoryResult["stats"]>(null)
    const [filter,    setFilter]    = useState<CallHistoryFilter>("all")
    const [page,      setPage]      = useState(1)
    const [pages,     setPages]     = useState(1)
    const [isPending, startTransition] = useTransition()

    const fetchCalls = useCallback((targetPage: number, append: boolean) => {
        startTransition(async () => {
            const res = await getCallHistoryAction({
                perspective,
                filter,
                page:  targetPage,
                limit: 20,
            })
            if ("error" in res) return

            setCalls((prev) => (append ? [...prev, ...res.calls] : res.calls))
            setStats(res.stats)
            setPages(res.pages)
            setPage(res.page)
        })
    }, [perspective, filter])

    useEffect(() => { fetchCalls(1, false) }, [fetchCalls])

    const hasMore = page < pages

    return (
        <div className="call-history">

            {/* ── Header ── */}
            <div className="call-history__header">
                <div className="call-history__title">
                    <Phone size={18} />
                    <h2>Calls</h2>
                </div>

                <div className="call-history__filters">
                    {(["all", "missed"] as CallHistoryFilter[]).map((f) => (
                        <button
                            key={f}
                            className={`call-filter-btn ${filter === f ? "call-filter-btn--active" : ""}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === "all" ? "All" : "Missed"}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Creator stats ── */}
            {perspective === "creator" && stats && (
                <div className="call-history__stats">
                    <div className="call-stat">
                        <PhoneCall size={14} />
                        <div>
                            <p className="call-stat__value">{stats.totalCalls}</p>
                            <p className="call-stat__label">Total calls</p>
                        </div>
                    </div>
                    <div className="call-stat">
                        <PhoneMissed size={14} />
                        <div>
                            <p className="call-stat__value">{stats.missedCalls}</p>
                            <p className="call-stat__label">Missed</p>
                        </div>
                    </div>
                    <div className="call-stat">
                        <Clock size={14} />
                        <div>
                            <p className="call-stat__value">{stats.totalMinutes} min</p>
                            <p className="call-stat__label">Talk time</p>
                        </div>
                    </div>
                    <div className="call-stat">
                        <Banknote size={14} />
                        <div>
                            <p className="call-stat__value">
                                ₦{stats.netEarnings.toLocaleString()}
                            </p>
                            <p className="call-stat__label">Earned</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── List ── */}
            <div className="call-history__list">
                {isPending && calls.length === 0 ? (
                    <div className="call-history__loading">
                        <Loader2 size={20} className="spin" />
                    </div>
                ) : calls.length === 0 ? (
                    <div className="call-history__empty">
                        <Phone size={32} />
                        <p>{filter === "missed" ? "No missed calls" : "No calls yet"}</p>
                        <span>
                            {perspective === "fan"
                                ? "Call a creator from your conversation with them"
                                : "Calls from fans will appear here"}
                        </span>
                    </div>
                ) : (
                    calls.map((call) => {
                        const meta = outcomeMeta(call, perspective)
                        const amount = perspective === "creator"
                            ? call.billedAmount - call.platformFee
                            : call.billedAmount

                        return (
                            <div key={call.id} className={`call-row call-row--${meta.cls}`}>

                                <div className="call-row__avatar">
                                    {call.counterpart.image ? (
                                        <Image
                                            src={call.counterpart.image}
                                            alt={call.counterpart.name}
                                            width={40}
                                            height={40}
                                        />
                                    ) : (
                                        <span>
                                            {call.counterpart.name.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="call-row__info">
                                    <div className="call-row__top">
                                        <span className="call-row__name">
                                            {call.counterpart.name}
                                        </span>
                                        {call.isTopFanCall && (
                                            <span className="call-row__topfan" title="Top fan — free call">
                                                <Star size={10} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="call-row__meta">
                                        <span className={`call-row__outcome call-row__outcome--${meta.cls}`}>
                                            {meta.icon}
                                            {meta.label}
                                            {" · "}
                                            {call.type === "VOICE" ? "Voice" : "Video"}
                                        </span>
                                    </div>
                                </div>

                                <div className="call-row__right">
                                    <span className="call-row__time">
                                        {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}
                                    </span>
                                    {call.status === "ENDED" && (
                                        <span className="call-row__detail">
                                            {call.durationMinutes} min
                                            {amount > 0 && ` · ₦${amount.toLocaleString()}`}
                                            {call.isFreeCall && amount === 0 && " · Free"}
                                        </span>
                                    )}
                                </div>

                                {/* Open the conversation (call back lives there) */}
                                <Link
                                    href={conversationHref(perspective, call.conversationId)}
                                    className="call-row__open"
                                    title="Open conversation"
                                >
                                    <MessageCircle size={16} />
                                </Link>
                            </div>
                        )
                    })
                )}

                {hasMore && (
                    <button
                        className="call-history__load-more"
                        onClick={() => fetchCalls(page + 1, true)}
                        disabled={isPending}
                    >
                        {isPending
                            ? <Loader2 size={14} className="spin" />
                            : "Load more"}
                    </button>
                )}
            </div>
        </div>
    )
}