// components/creator/feed/StoriesRow.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Plus, Eye, Trash2, Loader2, X, Clock } from "lucide-react"
import {
    getMyStoriesAction, deleteStoryAction, getStoryViewersAction,
} from "@/actions/stories"
import { StoryComposer } from "./StoryComposer"
import { formatDistanceToNowStrict } from "date-fns"
import "@/styles/creator/feed/StoriesRow.scss"

type Story   = Awaited<ReturnType<typeof getMyStoriesAction>>[0]
type Viewers = Extract<Awaited<ReturnType<typeof getStoryViewersAction>>, { viewers: any }>["viewers"]

export const StoriesRow = () => {
    const [stories,     setStories]     = useState<Story[]>([])
    const [showComposer, setShowComposer] = useState(false)
    const [activeStory, setActiveStory] = useState<Story | null>(null)
    const [viewers,     setViewers]     = useState<Viewers | null>(null)
    const [isPending,   startTransition] = useTransition()

    const fetchStories = useCallback(() => {
        startTransition(async () => {
            setStories(await getMyStoriesAction())
        })
    }, [])

    useEffect(() => { fetchStories() }, [fetchStories])

    const openViewers = (story: Story) => {
        setActiveStory(story)
        setViewers(null)
        startTransition(async () => {
            const res = await getStoryViewersAction(story.id)
            if ("viewers" in res && res.viewers !== undefined) setViewers(res.viewers)
        })
    }

    const handleDelete = (storyId: string) => {
        if (!confirm("Delete this story? This cannot be undone.")) return
        startTransition(async () => {
            const res = await deleteStoryAction(storyId)
            if (res?.success) {
                setStories((prev) => prev.filter((s) => s.id !== storyId))
                setActiveStory(null)
            }
        })
    }

    const timeLeft = (expiresAt: Date) =>
        formatDistanceToNowStrict(new Date(expiresAt))

    return (
        <div className="stories-row">
            <div className="stories-row__scroll">

                {/* Add tile */}
                <button
                    className="story-tile story-tile--add"
                    onClick={() => setShowComposer(true)}
                >
                    <div className="story-tile__add-circle">
                        <Plus size={20} />
                    </div>
                    <span>Add Story</span>
                </button>

                {/* Active stories */}
                {stories.map((story) => (
                    <button
                        key={story.id}
                        className="story-tile"
                        onClick={() => openViewers(story)}
                    >
                        <div className="story-tile__frame">
                            {story.mediaType === "TEXT_CARD" ? (
                                <div
                                    className="story-tile__text-card"
                                    style={{ backgroundColor: story.backgroundColor ?? "#1a1a2e" }}
                                >
                                    <span>{story.body?.slice(0, 40)}</span>
                                </div>
                            ) : (
                                <img
                                    src={story.thumbnailUrl ?? story.mediaUrl ?? ""}
                                    alt="Story"
                                />
                            )}
                            <span className="story-tile__views">
                                <Eye size={11} /> {story.viewCount}
                            </span>
                        </div>
                        <span className="story-tile__expiry">
                            <Clock size={10} /> {timeLeft(story.expiresAt)} left
                        </span>
                    </button>
                ))}

                {isPending && stories.length === 0 && (
                    <div className="stories-row__loading"><Loader2 size={18} className="spin" /></div>
                )}
            </div>

            {/* Composer */}
            {showComposer && (
                <StoryComposer
                    onClose={() => setShowComposer(false)}
                    onSuccess={() => { setShowComposer(false); fetchStories() }}
                />
            )}

            {/* Viewers sheet */}
            {activeStory && (
                <div className="story-viewers-overlay" onClick={() => setActiveStory(null)}>
                    <div className="story-viewers" onClick={(e) => e.stopPropagation()}>
                        <div className="story-viewers__header">
                            <h3><Eye size={15} /> {activeStory.viewCount} view{activeStory.viewCount !== 1 ? "s" : ""}</h3>
                            <div className="story-viewers__actions">
                                <button
                                    className="story-viewers__delete"
                                    onClick={() => handleDelete(activeStory.id)}
                                    disabled={isPending}
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                                <button onClick={() => setActiveStory(null)} aria-label="Close">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="story-viewers__list">
                            {viewers === null ? (
                                <div className="story-viewers__loading"><Loader2 size={16} className="spin" /></div>
                            ) : viewers.length === 0 ? (
                                <p className="story-viewers__empty">No views yet</p>
                            ) : (
                                viewers.map((v, i) => v.user && (
                                    <div key={i} className="story-viewer-item">
                                        {v.user.image
                                            ? <img src={v.user.image} alt={v.user.name} />
                                            : <div className="story-viewer-item__initial">{v.user.name[0]}</div>
                                        }
                                        <div className="story-viewer-item__text">
                                            <span className="story-viewer-item__name">{v.user.name}</span>
                                            <span className="story-viewer-item__handle">@{v.user.username}</span>
                                        </div>
                                        <span className="story-viewer-item__time">
                                            {formatDistanceToNowStrict(new Date(v.viewedAt))} ago
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}