// components/creator/drafts/DraftsPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import {
    FileText, PenLine, Loader2,
    Clock, Trash2, CheckCircle,
} from "lucide-react"
import { getCreatorPostsAction, deletePostAction, publishDraftAction } from "@/actions/creator/posts"
import { PostCard } from "@/component/creator/feed/PostCard"
import { CreatePostModal } from "@/component/creator/feed/CreatePostModal"
import "@/styles/creator/drafts/DraftsPage.scss"

type Post = Awaited<ReturnType<typeof getCreatorPostsAction>>["posts"][0]

export const DraftsPage = () => {

    const [posts, setPosts] = useState<Post[]>([])
    const [total, setTotal] = useState(0)
    const [showModal, setShowModal] = useState(false)
    const [editPost, setEditPost] = useState<Post | null>(null)
    const [isPending, startTransition] = useTransition()

    const fetchDrafts = useCallback(() => {
        startTransition(async () => {
            const res = await getCreatorPostsAction({
                status: "DRAFT",
                limit: 50,
            })
            setPosts(res.posts)
            setTotal(res.total)
        })
    }, [])

    useEffect(() => { fetchDrafts() }, [fetchDrafts])

    const handleDeleted = (id: string) => setPosts((p) => p.filter((post) => post.id !== id))
    const handlePublished = (id: string) => setPosts((p) => p.filter((post) => post.id !== id))

    const handlePublishAll = () => {
        if (!confirm(`Publish all ${total} drafts?`)) return
        startTransition(async () => {
            await Promise.all(posts.map((p) => publishDraftAction(p.id)))
            fetchDrafts()
        })
    }

    return (
        <div className="drafts-page">

            {/* ── Header ── */}
            <div className="drafts-page__header">
                <div className="drafts-page__title">
                    <FileText size={20} />
                    <div>
                        <h2>Drafts</h2>
                        <p>
                            {total === 0
                                ? "No saved drafts"
                                : `${total} unpublished draft${total !== 1 ? "s" : ""}`
                            }
                        </p>
                    </div>
                </div>

                <div className="drafts-page__actions">
                    {total > 1 && (
                        <button
                            className="drafts-btn drafts-btn--outline"
                            onClick={handlePublishAll}
                            disabled={isPending}
                        >
                            <CheckCircle size={15} />
                            Publish All
                        </button>
                    )}
                    <button
                        className="drafts-btn drafts-btn--primary"
                        onClick={() => setShowModal(true)}
                    >
                        <PenLine size={15} />
                        New Draft
                    </button>
                </div>
            </div>

            {/* ── Content ── */}
            {isPending ? (
                <div className="drafts-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : posts.length === 0 ? (
                <div className="drafts-page__empty">
                    <div className="drafts-empty__icon">
                        <FileText size={32} />
                    </div>
                    <h3>No drafts saved</h3>
                    <p>
                        Start writing something and save it as a draft.
                        It won't be visible to your audience until you publish it.
                    </p>
                    <button
                        className="drafts-btn drafts-btn--primary"
                        onClick={() => setShowModal(true)}
                    >
                        <PenLine size={15} />
                        Start a draft
                    </button>
                </div>
            ) : (
                <>
                    {/* ── Info banner ── */}
                    <div className="drafts-page__banner">
                        <Clock size={14} />
                        <span>
                            Drafts are only visible to you. Publish when you're ready.
                        </span>
                    </div>

                    {/* ── Grid ── */}
                    <div className="drafts-page__grid">
                        {posts.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                onEdit={(p) => {
                                    setEditPost(p)
                                    setShowModal(true)
                                }}
                                onDeleted={handleDeleted}
                                onPublished={handlePublished}
                            />
                        ))}
                    </div>
                </>
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
                        fetchDrafts()
                    }}
                />
            )}

        </div>
    )
}