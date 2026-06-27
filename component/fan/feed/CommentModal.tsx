"use client"

import { useState, useEffect, useRef, useTransition } from "react"
import Image                                           from "next/image"
import {
    X, Send, Loader2, MessageCircle,
    CornerDownRight, ChevronDown,
} from "lucide-react"
import {
    getCommentsAction,
    addCommentAction,
} from "@/actions/fan/interactions"
import { formatDistanceToNow } from "date-fns"
import "@/styles/fan/CommentModal.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type UserInfo = {
    id:        string
    username:  string | null
    firstName: string | null
    lastName:  string | null
    image:     string | null
}

type Reply = {
    id:        string
    body:      string
    userId:    string
    createdAt: Date
    user:      UserInfo | null
}

type Comment = {
    id:        string
    body:      string
    userId:    string
    createdAt: Date
    user:      UserInfo | null
    replies:   Reply[]
}

type Props = {
    postId:       string
    currentUserId: string
    onClose:      () => void
    onCommentAdded?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(user: UserInfo | null): string {
    if (!user) return "Anonymous"
    const full = [user.firstName, user.lastName].filter(Boolean).join(" ")
    return full || user.username || "Anonymous"
}

function avatarInitial(user: UserInfo | null): string {
    return displayName(user).charAt(0).toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommentModal({ postId, currentUserId, onClose, onCommentAdded }: Props) {
    const [comments, setComments] = useState<Comment[]>([])
    const [total,    setTotal]    = useState(0)
    const [page,     setPage]     = useState(1)
    const [pages,    setPages]    = useState(1)
    const [loading,  setLoading]  = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)

    // New comment
    const [body,    setBody]    = useState("")
    const [error,   setError]   = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    // Reply state
    const [replyingTo, setReplyingTo] = useState<{ commentId: string; userName: string } | null>(null)

    const inputRef  = useRef<HTMLTextAreaElement>(null)
    const listRef   = useRef<HTMLDivElement>(null)

    // ── Load comments ─────────────────────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                const data = await getCommentsAction({ postId, page: 1 })
                setComments(data.comments as Comment[])
                setTotal(data.total)
                setPages(data.pages)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [postId])

    // ── Load more ─────────────────────────────────────────────────────────────
    const loadMore = async () => {
        if (loadingMore || page >= pages) return
        setLoadingMore(true)
        const nextPage = page + 1
        const data = await getCommentsAction({ postId, page: nextPage })
        setComments((prev) => {
            const ids = new Set(prev.map((c) => c.id))
            return [...prev, ...(data.comments as Comment[]).filter((c) => !ids.has(c.id))]
        })
        setPage(nextPage)
        setPages(data.pages)
        setLoadingMore(false)
    }

    // ── Submit comment ────────────────────────────────────────────────────────
    const handleSubmit = () => {
        if (!body.trim()) return
        setError(null)

        startTransition(async () => {
            const res = await addCommentAction({
                postId,
                body:     body.trim(),
                parentId: replyingTo?.commentId,
            })

            if (res.error) {
                setError(res.error)
                return
            }

            setBody("")
            setReplyingTo(null)
            onCommentAdded?.()

            // Reload comments to get fresh data with user info
            const data = await getCommentsAction({ postId, page: 1 })
            setComments(data.comments as Comment[])
            setTotal(data.total)
            setPages(data.pages)
            setPage(1)

            // Scroll to top to see new comment
            listRef.current?.scrollTo({ top: 0, behavior: "smooth" })
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
        }
    }

    // ── Focus input when replying ─────────────────────────────────────────────
    const handleReply = (commentId: string, userName: string) => {
        setReplyingTo({ commentId, userName })
        inputRef.current?.focus()
    }

    const cancelReply = () => {
        setReplyingTo(null)
    }

    // ── Close on backdrop click ───────────────────────────────────────────────
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose()
    }

    return (
        <div className="comment-modal-overlay" onClick={handleBackdropClick}>
            <div className="comment-modal">

                {/* ── Header ── */}
                <div className="comment-modal__header">
                    <div className="comment-modal__header-left">
                        <MessageCircle size={18} />
                        <h3>Comments {total > 0 && <span>({total})</span>}</h3>
                    </div>
                    <button
                        className="comment-modal__close"
                        onClick={onClose}
                        aria-label="Close comments"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* ── Comment list ── */}
                <div className="comment-modal__list" ref={listRef}>
                    {loading ? (
                        <div className="comment-modal__loading">
                            <Loader2 size={20} className="spin" />
                        </div>
                    ) : comments.length === 0 ? (
                        <div className="comment-modal__empty">
                            <MessageCircle size={32} />
                            <p>No comments yet</p>
                            <span>Be the first to share your thoughts</span>
                        </div>
                    ) : (
                        <>
                            {comments.map((comment) => (
                                <div key={comment.id} className="comment-item">
                                    {/* Comment */}
                                    <div className="comment-item__main">
                                        <div className="comment-item__avatar">
                                            {comment.user?.image ? (
                                                <Image
                                                    src={comment.user.image}
                                                    alt={displayName(comment.user)}
                                                    width={32}
                                                    height={32}
                                                />
                                            ) : (
                                                <span>{avatarInitial(comment.user)}</span>
                                            )}
                                        </div>

                                        <div className="comment-item__content">
                                            <div className="comment-item__meta">
                                                <span className="comment-item__name">
                                                    {displayName(comment.user)}
                                                </span>
                                                <span className="comment-item__time">
                                                    {formatDistanceToNow(
                                                        new Date(comment.createdAt),
                                                        { addSuffix: false }
                                                    )}
                                                </span>
                                            </div>
                                            <p className="comment-item__body">{comment.body}</p>
                                            <button
                                                className="comment-item__reply-btn"
                                                onClick={() => handleReply(comment.id, displayName(comment.user))}
                                            >
                                                Reply
                                            </button>
                                        </div>
                                    </div>

                                    {/* Replies */}
                                    {comment.replies.length > 0 && (
                                        <div className="comment-item__replies">
                                            {comment.replies.map((reply) => (
                                                <div key={reply.id} className="comment-item__reply">
                                                    <div className="comment-item__avatar comment-item__avatar--sm">
                                                        {reply.user?.image ? (
                                                            <Image
                                                                src={reply.user.image}
                                                                alt={displayName(reply.user)}
                                                                width={24}
                                                                height={24}
                                                            />
                                                        ) : (
                                                            <span>{avatarInitial(reply.user)}</span>
                                                        )}
                                                    </div>
                                                    <div className="comment-item__content">
                                                        <div className="comment-item__meta">
                                                            <span className="comment-item__name">
                                                                {displayName(reply.user)}
                                                            </span>
                                                            <span className="comment-item__time">
                                                                {formatDistanceToNow(
                                                                    new Date(reply.createdAt),
                                                                    { addSuffix: false }
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="comment-item__body">{reply.body}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Load more */}
                            {page < pages && (
                                <button
                                    className="comment-modal__load-more"
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? (
                                        <Loader2 size={14} className="spin" />
                                    ) : (
                                        <>
                                            <ChevronDown size={14} />
                                            Load more comments
                                        </>
                                    )}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* ── Input area ── */}
                <div className="comment-modal__input-area">
                    {replyingTo && (
                        <div className="comment-modal__replying">
                            <CornerDownRight size={12} />
                            <span>Replying to {replyingTo.userName}</span>
                            <button onClick={cancelReply} aria-label="Cancel reply">
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    {error && (
                        <p className="comment-modal__error">{error}</p>
                    )}

                    <div className="comment-modal__input-row">
                        <textarea
                            ref={inputRef}
                            className="comment-modal__input"
                            placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : "Add a comment..."}
                            value={body}
                            onChange={(e) => {
                                setBody(e.target.value)
                                setError(null)
                            }}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            maxLength={1000}
                            disabled={isPending}
                        />
                        <button
                            className="comment-modal__send"
                            onClick={handleSubmit}
                            disabled={!body.trim() || isPending}
                            aria-label="Send comment"
                        >
                            {isPending ? (
                                <Loader2 size={16} className="spin" />
                            ) : (
                                <Send size={16} />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
