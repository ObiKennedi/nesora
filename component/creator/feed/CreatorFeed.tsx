// components/creator/feed/CreatorFeed.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { PenLine, Loader2 } from "lucide-react"
import { PostCard } from "./PostCard"
import { FeedFilters } from "./FeedFilters"
import { CreatePostModal } from "./CreatePostModal"
import { getCreatorPostsAction } from "@/actions/creator/posts"
import { PostStatus, PostType } from "@prisma/client"
import { useSearchParams } from "next/navigation"
import "@/styles/creator/feed/CreatorFeed.scss"

type Post = Awaited<ReturnType<typeof getCreatorPostsAction>>["posts"][0]

export const CreatorFeed = () => {

    const searchParams = useSearchParams()

    const [posts, setPosts] = useState<Post[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pages, setPages] = useState(1)
    const [status, setStatus] = useState<PostStatus | "ALL">("ALL")
    const [type, setType] = useState<PostType | "ALL">("ALL")
    const [showModal, setShowModal] = useState(false)
    const [editPost, setEditPost] = useState<Post | null>(null)
    const [isPending, startTransition] = useTransition()

    // Open modal from query param (e.g. Quick Actions)
    const actionParam = searchParams.get("action")
    const initialType: PostType = (
        actionParam === "video" ? "VIDEO" :
            actionParam === "photo" ? "PHOTO" :
                actionParam === "announcement" ? "TEXT" : "TEXT"
    )

    useEffect(() => {
        if (actionParam) setShowModal(true)
    }, [actionParam])

    const fetchPosts = useCallback(() => {
        startTransition(async () => {
            const res = await getCreatorPostsAction({
                status: status === "ALL" ? undefined : status,
                type: type === "ALL" ? undefined : type,
                page,
                limit: 12,
            })
            setPosts(res.posts)
            setTotal(res.total)
            setPages(res.pages)
        })
    }, [status, type, page])

    useEffect(() => { fetchPosts() }, [fetchPosts])

    const handleDeleted = (id: string) => setPosts((p) => p.filter((post) => post.id !== id))
    const handlePublished = (id: string) => setPosts((p) =>
        p.map((post) => post.id === id ? { ...post, status: "PUBLISHED" } : post)
    )

    return (
        <div className="creator-feed">

            {/* ── Toolbar ── */}
            <div className="creator-feed__toolbar">
                <div className="creator-feed__left">
                    <h2 className="creator-feed__count">
                        {total} post{total !== 1 ? "s" : ""}
                    </h2>
                    <FeedFilters
                        status={status}
                        type={type}
                        onStatus={(s) => { setStatus(s); setPage(1) }}
                        onType={(t) => { setType(t); setPage(1) }}
                    />
                </div>

                <button
                    className="creator-feed__create-btn"
                    onClick={() => setShowModal(true)}
                >
                    <PenLine size={16} />
                    Create Post
                </button>
            </div>

            {/* ── Grid ── */}
            {isPending ? (
                <div className="creator-feed__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : posts.length === 0 ? (
                <div className="creator-feed__empty">
                    <PenLine size={32} />
                    <p>No posts yet</p>
                    <span>
                        {status !== "ALL"
                            ? `You have no ${status.toLowerCase()} posts.`
                            : "Create your first post to get started."
                        }
                    </span>
                    <button
                        className="creator-feed__create-btn"
                        onClick={() => setShowModal(true)}
                    >
                        Create your first post
                    </button>
                </div>
            ) : (
                <div className="creator-feed__grid">
                    {posts.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            onEdit={(p) => { setEditPost(p); setShowModal(true) }}
                            onDeleted={handleDeleted}
                            onPublished={handlePublished}
                        />
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {pages > 1 && (
                <div className="creator-feed__pagination">
                    <button
                        className="page-btn"
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 1 || isPending}
                    >
                        Previous
                    </button>
                    <span className="page-indicator">
                        Page {page} of {pages}
                    </span>
                    <button
                        className="page-btn"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page === pages || isPending}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* ── Modal ── */}
            {showModal && (
                <CreatePostModal
                    initialType={editPost ? editPost.type as PostType : initialType}
                    onClose={() => { setShowModal(false); setEditPost(null) }}
                    onSuccess={() => {
                        setShowModal(false)
                        setEditPost(null)
                        fetchPosts()
                    }}
                />
            )}

        </div>
    )
}