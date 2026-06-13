// components/creator/feed/PostCard.tsx
"use client"

import { useState, useTransition } from "react"
import {
    Eye, Heart, MessageCircle, MoreHorizontal,
    Edit2, Trash2, Globe, Lock, Clock,
    Type, Image, Video, Mic, BarChart2,
    CheckCircle, Loader2,
} from "lucide-react"
import { deletePostAction, getCreatorPostsAction, publishDraftAction } from "@/actions/creator/posts"
import { format } from "date-fns"
import "@/styles/creator/feed/PostCard.scss"

type Post = Awaited<ReturnType<typeof getCreatorPostsAction>>["posts"][0]

type Props = {
    post: Post
    onEdit: (post: Post) => void
    onDeleted: (postId: string) => void
    onPublished: (postId: string) => void
}

const typeIcon: Record<string, React.ReactNode> = {
    TEXT: <Type size={13} />,
    PHOTO: <Image size={13} />,
    VIDEO: <Video size={13} />,
    AUDIO: <Mic size={13} />,
    POLL: <BarChart2 size={13} />,
}

const statusColor: Record<string, string> = {
    PUBLISHED: "green",
    DRAFT: "amber",
    SCHEDULED: "blue",
}

export const PostCard = ({ post, onEdit, onDeleted, onPublished }: Props) => {

    const [menuOpen, setMenuOpen] = useState(false)
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        if (!confirm("Delete this post? This cannot be undone.")) return
        startTransition(async () => {
            const res = await deletePostAction(post.id)
            if (res?.success) onDeleted(post.id)
        })
    }

    const handlePublish = () => {
        startTransition(async () => {
            const res = await publishDraftAction(post.id)
            if (res?.success) onPublished(post.id)
        })
    }

    const totalPollVotes = post.poll?.options.reduce((s, o) => s + o.voteCount, 0) ?? 0

    return (
        <div className={`post-card post-card--${post.status.toLowerCase()}`}>

            {/* ── Header ── */}
            <div className="post-card__header">
                <div className="post-card__meta">
                    <span className={`post-badge post-badge--type`}>
                        {typeIcon[post.type]}
                        {post.type.charAt(0) + post.type.slice(1).toLowerCase()}
                    </span>
                    <span className={`post-badge post-badge--${statusColor[post.status]}`}>
                        {post.status === "PUBLISHED" && <CheckCircle size={11} />}
                        {post.status === "SCHEDULED" && <Clock size={11} />}
                        {post.status.charAt(0) + post.status.slice(1).toLowerCase()}
                    </span>
                    <span className="post-badge post-badge--visibility">
                        {post.visibility === "PUBLIC"
                            ? <><Globe size={11} /> Public</>
                            : <><Lock size={11} /> Subscribers</>
                        }
                    </span>
                </div>

                {/* Menu */}
                <div className="post-card__menu-wrap">
                    <button
                        className="post-card__menu-btn"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-label="Post options"
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {menuOpen && (
                        <div className="post-card__menu">
                            <button onClick={() => { onEdit(post); setMenuOpen(false) }}>
                                <Edit2 size={14} /> Edit
                            </button>
                            {post.status === "DRAFT" && (
                                <button onClick={() => { handlePublish(); setMenuOpen(false) }}>
                                    <CheckCircle size={14} /> Publish Now
                                </button>
                            )}
                            <button
                                className="post-card__menu-delete"
                                onClick={() => { handleDelete(); setMenuOpen(false) }}
                            >
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Content ── */}
            <div className="post-card__content">
                {post.body && (
                    <p className="post-card__body">{post.body}</p>
                )}

                {/* Photo */}
                {post.type === "PHOTO" && post.mediaUrls.length > 0 && (
                    <div className={`post-media post-media--photos post-media--${Math.min(post.mediaUrls.length, 4)}`}>
                        {post.mediaUrls.slice(0, 4).map((url, i) => (
                            <div key={url} className="post-media__item">
                                <img src={url} alt={`Photo ${i + 1}`} />
                                {i === 3 && post.mediaUrls.length > 4 && (
                                    <div className="post-media__more">
                                        +{post.mediaUrls.length - 4}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Video */}
                {post.type === "VIDEO" && post.mediaUrls[0] && (
                    <div className="post-media post-media--video">
                        <video src={post.mediaUrls[0]} controls />
                    </div>
                )}

                {/* Audio */}
                {post.type === "AUDIO" && post.mediaUrls[0] && (
                    <div className="post-media post-media--audio">
                        <Mic size={20} />
                        <audio src={post.mediaUrls[0]} controls />
                    </div>
                )}

                {/* Poll */}
                {post.type === "POLL" && post.poll && (
                    <div className="post-poll">
                        <p className="post-poll__question">{post.poll.question}</p>
                        <div className="post-poll__options">
                            {post.poll.options.map((opt) => {
                                const pct = totalPollVotes > 0
                                    ? Math.round((opt.voteCount / totalPollVotes) * 100)
                                    : 0
                                return (
                                    <div key={opt.id} className="poll-result">
                                        <div className="poll-result__bar" style={{ width: `${pct}%` }} />
                                        <span className="poll-result__text">{opt.text}</span>
                                        <span className="poll-result__pct">{pct}%</span>
                                    </div>
                                )
                            })}
                        </div>
                        <p className="post-poll__total">{totalPollVotes} votes</p>
                    </div>
                )}
            </div>

            {/* ── Footer: stats + date ── */}
            <div className="post-card__footer">
                <div className="post-card__stats">
                    <span><Eye size={13} /> {post.viewCount}</span>
                    <span><Heart size={13} /> {post.likeCount}</span>
                    <span><MessageCircle size={13} /> {post.commentCount}</span>
                </div>

                <span className="post-card__date">
                    {post.status === "SCHEDULED" && post.scheduledAt
                        ? `Scheduled · ${format(new Date(post.scheduledAt), "d MMM · h:mm a")}`
                        : post.publishedAt
                            ? format(new Date(post.publishedAt), "d MMM yyyy")
                            : format(new Date(post.createdAt), "d MMM yyyy")
                    }
                </span>

                {isPending && <Loader2 size={14} className="spin" />}
            </div>

        </div>
    )
}