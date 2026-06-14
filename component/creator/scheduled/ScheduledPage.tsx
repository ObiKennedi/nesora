// components/creator/scheduled/ScheduledPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import {
    CalendarClock, Loader2, Clock,
    CheckCircle, X, Edit2, PenLine,
    AlertCircle, Calendar,
} from "lucide-react"
import {
    getCreatorPostsAction,
    publishDraftAction,
    reschedulePostAction,
    cancelScheduleAction,
} from "@/actions/creator/posts"
import { CreatePostModal } from "@/component/creator/feed/CreatePostModal"
import { format, formatDistanceToNow, isPast, isToday, isTomorrow } from "date-fns"
import "@/styles/creator/scheduled/ScheduledPage.scss"

type Post = Awaited<ReturnType<typeof getCreatorPostsAction>>["posts"][0]

// ── Time label helper ─────────────────────────────────────────────────────────

const getTimeLabel = (date: Date) => {
    if (isPast(date)) return { label: "Overdue", color: "red" }
    if (isToday(date)) return { label: "Today", color: "amber" }
    if (isTomorrow(date)) return { label: "Tomorrow", color: "blue" }
    return { label: "Upcoming", color: "green" }
}

// ── Reschedule inline form ────────────────────────────────────────────────────

const RescheduleForm = ({
    postId,
    currentDate,
    onDone,
    onCancel,
}: {
    postId: string
    currentDate: Date
    onDone: () => void
    onCancel: () => void
}) => {
    const [value, setValue] = useState(
        format(currentDate, "yyyy-MM-dd'T'HH:mm")
    )
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await reschedulePostAction(postId, new Date(value).toISOString())
            if (res?.error) setError(res.error)
            else onDone()
        })
    }

    return (
        <div className="reschedule-form">
            <input
                type="datetime-local"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                disabled={isPending}
            />
            {error && <p className="reschedule-form__error">{error}</p>}
            <div className="reschedule-form__actions">
                <button
                    className="reschedule-btn reschedule-btn--save"
                    onClick={handleSave}
                    disabled={isPending}
                >
                    {isPending
                        ? <Loader2 size={13} className="spin" />
                        : <CheckCircle size={13} />
                    }
                    Save
                </button>
                <button
                    className="reschedule-btn reschedule-btn--cancel"
                    onClick={onCancel}
                    disabled={isPending}
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ── Scheduled post card ───────────────────────────────────────────────────────

const ScheduledCard = ({
    post,
    onPublish,
    onCancel,
    onRescheduled,
    onEdit,
}: {
    post: Post
    onPublish: (id: string) => void
    onCancel: (id: string) => void
    onRescheduled: () => void
    onEdit: (post: Post) => void
}) => {
    const [rescheduling, setRescheduling] = useState(false)
    const [isPending, startTransition] = useTransition()

    const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null
    const timeInfo = scheduledDate ? getTimeLabel(scheduledDate) : null

    const handlePublishNow = () => {
        startTransition(async () => {
            const res = await publishDraftAction(post.id)
            if (res?.success) onPublish(post.id)
        })
    }

    const handleCancel = () => {
        if (!confirm("Cancel this schedule? The post will become a draft.")) return
        startTransition(async () => {
            const res = await cancelScheduleAction(post.id)
            if (res?.success) onCancel(post.id)
        })
    }

    const typeLabel: Record<string, string> = {
        TEXT: "Text",
        PHOTO: "Photo",
        VIDEO: "Video",
        AUDIO: "Audio",
        POLL: "Poll",
    }

    return (
        <div className={`scheduled-card ${timeInfo?.color === "red" ? "scheduled-card--overdue" : ""}`}>

            {/* ── Time badge ── */}
            <div className="scheduled-card__header">
                <div className="scheduled-card__badges">
                    <span className={`sched-badge sched-badge--${timeInfo?.color}`}>
                        <Clock size={11} />
                        {timeInfo?.label}
                    </span>
                    <span className="sched-badge sched-badge--type">
                        {typeLabel[post.type]}
                    </span>
                    {post.visibility === "SUBSCRIBERS_ONLY" && (
                        <span className="sched-badge sched-badge--locked">
                            🔒 Subscribers
                        </span>
                    )}
                </div>

                {/* Overdue warning */}
                {timeInfo?.color === "red" && (
                    <div className="scheduled-card__overdue">
                        <AlertCircle size={13} />
                        <span>Missed schedule — publish or reschedule</span>
                    </div>
                )}
            </div>

            {/* ── Content preview ── */}
            <div className="scheduled-card__content">
                {post.body && (
                    <p className="scheduled-card__body">{post.body}</p>
                )}
                {post.type === "PHOTO" && post.mediaUrls.length > 0 && (
                    <div className="scheduled-card__media">
                        <img src={post.mediaUrls[0]} alt="Preview" />
                        {post.mediaUrls.length > 1 && (
                            <span className="scheduled-card__media-count">
                                +{post.mediaUrls.length - 1} more
                            </span>
                        )}
                    </div>
                )}
                {post.type === "POLL" && post.poll && (
                    <p className="scheduled-card__poll-preview">
                        📊 {post.poll.question}
                    </p>
                )}
            </div>

            {/* ── Schedule time ── */}
            <div className="scheduled-card__time">
                <Calendar size={13} />
                {scheduledDate ? (
                    <span>
                        {format(scheduledDate, "EEE d MMM yyyy · h:mm a")}
                        {" · "}
                        <em>
                            {isPast(scheduledDate)
                                ? `${formatDistanceToNow(scheduledDate)} ago`
                                : `in ${formatDistanceToNow(scheduledDate)}`
                            }
                        </em>
                    </span>
                ) : "—"}
            </div>

            {/* ── Reschedule form ── */}
            {rescheduling && scheduledDate && (
                <RescheduleForm
                    postId={post.id}
                    currentDate={scheduledDate}
                    onDone={() => {
                        setRescheduling(false)
                        onRescheduled()
                    }}
                    onCancel={() => setRescheduling(false)}
                />
            )}

            {/* ── Actions ── */}
            <div className="scheduled-card__actions">
                <button
                    className="sched-action sched-action--publish"
                    onClick={handlePublishNow}
                    disabled={isPending}
                >
                    {isPending
                        ? <Loader2 size={14} className="spin" />
                        : <CheckCircle size={14} />
                    }
                    Publish Now
                </button>

                <button
                    className="sched-action sched-action--reschedule"
                    onClick={() => setRescheduling((v) => !v)}
                    disabled={isPending}
                >
                    <Edit2 size={14} />
                    Reschedule
                </button>

                <button
                    className="sched-action sched-action--edit"
                    onClick={() => onEdit(post)}
                    disabled={isPending}
                >
                    <PenLine size={14} />
                    Edit
                </button>

                <button
                    className="sched-action sched-action--cancel"
                    onClick={handleCancel}
                    disabled={isPending}
                >
                    <X size={14} />
                    Cancel
                </button>
            </div>

        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export const ScheduledPage = () => {

    const [posts, setPosts] = useState<Post[]>([])
    const [total, setTotal] = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [editPost, setEditPost] = useState<Post | null>(null)
    const [isPending, startTransition] = useTransition()

    const fetchScheduled = useCallback(() => {
        startTransition(async () => {
            const res = await getCreatorPostsAction({
                status: "SCHEDULED",
                limit: 50,
            })
            setPosts(res.posts)
            setTotal(res.total)
        })
    }, [])

    useEffect(() => { fetchScheduled() }, [fetchScheduled])

    // Split into overdue and upcoming
    const now = new Date()
    const overdue = posts.filter((p) => p.scheduledAt && isPast(new Date(p.scheduledAt)))
    const upcoming = posts.filter((p) => p.scheduledAt && !isPast(new Date(p.scheduledAt)))

    const handlePublish = (id: string) => setPosts((p) => p.filter((post) => post.id !== id))
    const handleCancel = (id: string) => setPosts((p) => p.filter((post) => post.id !== id))
    const handleRescheduled = () => fetchScheduled()

    return (
        <div className="scheduled-page">

            {/* ── Header ── */}
            <div className="scheduled-page__header">
                <div className="scheduled-page__title">
                    <CalendarClock size={20} />
                    <div>
                        <h2>Scheduled Posts</h2>
                        <p>
                            {total === 0
                                ? "No scheduled posts"
                                : `${total} post${total !== 1 ? "s" : ""} scheduled`
                            }
                        </p>
                    </div>
                </div>

                <button
                    className="scheduled-page__create-btn"
                    onClick={() => setShowModal(true)}
                >
                    <CalendarClock size={15} />
                    Schedule a Post
                </button>
            </div>

            {isPending ? (
                <div className="scheduled-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : posts.length === 0 ? (
                <div className="scheduled-page__empty">
                    <div className="scheduled-empty__icon">
                        <CalendarClock size={32} />
                    </div>
                    <h3>Nothing scheduled yet</h3>
                    <p>
                        Schedule posts to go live automatically at the
                        best times for your audience.
                    </p>
                    <button
                        className="scheduled-page__create-btn"
                        onClick={() => setShowModal(true)}
                    >
                        <CalendarClock size={15} />
                        Schedule your first post
                    </button>
                </div>
            ) : (
                <div className="scheduled-page__content">

                    {/* ── Overdue ── */}
                    {overdue.length > 0 && (
                        <div className="scheduled-section">
                            <div className="scheduled-section__heading scheduled-section__heading--overdue">
                                <AlertCircle size={15} />
                                Overdue ({overdue.length})
                            </div>
                            <div className="scheduled-section__grid">
                                {overdue.map((post) => (
                                    <ScheduledCard
                                        key={post.id}
                                        post={post}
                                        onPublish={handlePublish}
                                        onCancel={handleCancel}
                                        onRescheduled={handleRescheduled}
                                        onEdit={(p) => {
                                            setEditPost(p)
                                            setShowModal(true)
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Upcoming ── */}
                    {upcoming.length > 0 && (
                        <div className="scheduled-section">
                            <div className="scheduled-section__heading">
                                <Clock size={15} />
                                Upcoming ({upcoming.length})
                            </div>
                            <div className="scheduled-section__grid">
                                {upcoming.map((post) => (
                                    <ScheduledCard
                                        key={post.id}
                                        post={post}
                                        onPublish={handlePublish}
                                        onCancel={handleCancel}
                                        onRescheduled={handleRescheduled}
                                        onEdit={(p) => {
                                            setEditPost(p)
                                            setShowModal(true)
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* ── Modal ── */}
            {showModal && (
                <CreatePostModal
                    initialType={editPost?.type as any ?? "TEXT"}
                    onClose={() => {
                        setShowModal(false)
                        setEditPost(null)
                    }}
                    onSuccess={() => {
                        setShowModal(false)
                        setEditPost(null)
                        fetchScheduled()
                    }}
                />
            )}

        </div>
    )
}