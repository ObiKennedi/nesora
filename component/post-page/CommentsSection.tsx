// component/post-page/CommentsSection.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Send, CornerDownRight } from "lucide-react"
import { getCommentsAction, addCommentAction } from "@/actions/fan/interactions"

type CommentUser = {
    id:        string
    username:  string
    firstName: string | null
    lastName:  string | null
    image:     string | null
} | null

type Reply = {
    id:        string
    body:      string
    userId:    string
    createdAt: Date
    user:      CommentUser
}

type Comment = {
    id:        string
    body:      string
    userId:    string
    createdAt: Date
    user:      CommentUser
    replies:   Reply[]
}

type Props = {
    postId:              string
    viewerAuthenticated: boolean
}

function displayName(user: CommentUser): string {
    if (!user) return "You"
    const full = [user.firstName, user.lastName].filter(Boolean).join(" ")
    return full || `@${user.username}`
}

function timeAgo(date: Date | string): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60)     return "just now"
    if (seconds < 3600)   return `${Math.floor(seconds / 60)}m`
    if (seconds < 86400)  return `${Math.floor(seconds / 3600)}h`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`
    return new Date(date).toLocaleDateString("en-NG", { day: "numeric", month: "short" })
}

export default function CommentsSection({ postId, viewerAuthenticated }: Props) {
    const [comments,   setComments]   = useState<Comment[]>([])
    const [page,       setPage]       = useState(1)
    const [pages,      setPages]      = useState(1)
    const [loading,    setLoading]    = useState(true)
    const [draft,      setDraft]      = useState("")
    const [replyTo,    setReplyTo]    = useState<Comment | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [error,      setError]      = useState<string | null>(null)

    const inputRef = useRef<HTMLTextAreaElement | null>(null)

    // getCommentsAction redirects unauthenticated users to /login,
    // so never call it for logged-out viewers — show the prompt instead.
    const loadPage = useCallback(async (pageToLoad: number) => {
        if (!viewerAuthenticated) {
            setLoading(false)
            return
        }
        setLoading(true)
        const result = await getCommentsAction({ postId, page: pageToLoad })
        setComments((prev) =>
            pageToLoad === 1 ? result.comments : [...prev, ...result.comments]
        )
        setPage(result.page)
        setPages(result.pages)
        setLoading(false)
    }, [postId, viewerAuthenticated])

    useEffect(() => {
        void loadPage(1)
    }, [loadPage])

    const submit = useCallback(async () => {
        const body = draft.trim()
        if (!body || submitting) return

        setSubmitting(true)
        setError(null)

        const result = await addCommentAction({
            postId,
            body,
            parentId: replyTo?.id,
        })

        if (result?.error) {
            setError(result.error)
        } else if (result?.comment) {
            const created = result.comment
            if (replyTo) {
                setComments((prev) => prev.map((c) =>
                    c.id === replyTo.id
                        ? {
                            ...c,
                            replies: [...c.replies, {
                                id:        created.id,
                                body:      created.body,
                                userId:    created.userId,
                                createdAt: created.createdAt,
                                user:      null, // "You"
                            }],
                        }
                        : c
                ))
            } else {
                setComments((prev) => [{
                    id:        created.id,
                    body:      created.body,
                    userId:    created.userId,
                    createdAt: created.createdAt,
                    user:      null, // "You"
                    replies:   [],
                }, ...prev])
            }
            setDraft("")
            setReplyTo(null)
        }

        setSubmitting(false)
    }, [draft, submitting, postId, replyTo])

    if (!viewerAuthenticated) {
        return (
            <div className="comments comments--gated">
                <p>
                    <Link href="/login" className="comments__login-link">Log in</Link>
                    {" "}to view and join the conversation.
                </p>
            </div>
        )
    }

    return (
        <div className="comments">
            {/* Composer */}
            <div className="comments__composer">
                {replyTo && (
                    <p className="comments__replying">
                        <CornerDownRight size={14} />
                        Replying to {displayName(replyTo.user)}
                        <button
                            type="button"
                            className="comments__cancel-reply"
                            onClick={() => setReplyTo(null)}
                        >
                            Cancel
                        </button>
                    </p>
                )}
                <div className="comments__input-row">
                    <textarea
                        ref={inputRef}
                        className="comments__input"
                        placeholder={replyTo ? "Write a reply…" : "Add a comment…"}
                        value={draft}
                        maxLength={1000}
                        rows={1}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault()
                                void submit()
                            }
                        }}
                    />
                    <button
                        type="button"
                        className="comments__send"
                        onClick={submit}
                        disabled={!draft.trim() || submitting}
                        aria-label="Send comment"
                    >
                        {submitting
                            ? <Loader2 size={16} className="comments__spinner" />
                            : <Send size={16} />}
                    </button>
                </div>
                {error && <p className="comments__error" role="alert">{error}</p>}
            </div>

            {/* List */}
            {loading && comments.length === 0 ? (
                <div className="comments__loading">
                    <Loader2 size={18} className="comments__spinner" />
                </div>
            ) : comments.length === 0 ? (
                <p className="comments__empty">No comments yet — start the conversation.</p>
            ) : (
                <ul className="comments__list">
                    {comments.map((comment) => (
                        <li key={comment.id} className="comments__item">
                            <CommentRow user={comment.user} body={comment.body} createdAt={comment.createdAt} />
                            <button
                                type="button"
                                className="comments__reply-btn"
                                onClick={() => {
                                    setReplyTo(comment)
                                    inputRef.current?.focus()
                                }}
                            >
                                Reply
                            </button>

                            {comment.replies.length > 0 && (
                                <ul className="comments__replies">
                                    {comment.replies.map((reply) => (
                                        <li key={reply.id} className="comments__item comments__item--reply">
                                            <CommentRow user={reply.user} body={reply.body} createdAt={reply.createdAt} />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {page < pages && !loading && (
                <button
                    type="button"
                    className="comments__load-more"
                    onClick={() => void loadPage(page + 1)}
                >
                    Load more comments
                </button>
            )}
        </div>
    )
}

function CommentRow({
    user, body, createdAt,
}: {
    user: CommentUser; body: string; createdAt: Date | string
}) {
    return (
        <div className="comments__row">
            {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="comments__avatar" />
            ) : (
                <span className="comments__avatar comments__avatar--fallback">
                    {displayName(user).charAt(0).toUpperCase()}
                </span>
            )}
            <div className="comments__content">
                <p className="comments__meta">
                    <span className="comments__author">{displayName(user)}</span>
                    <span className="comments__time">{timeAgo(createdAt)}</span>
                </p>
                <p className="comments__body">{body}</p>
            </div>
        </div>
    )
}