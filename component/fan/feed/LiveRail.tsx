// components/fan/feed/LiveRail.tsx — Stories & Live Rail at Top of Feed
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { recordStoryViewAction } from "@/actions/stories"
import { formatDistanceToNowStrict } from "date-fns"
import { getPusherClient } from "@/lib/pusher-client"

export type LiveStream = {
    id:    string
    title: string
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
}

export type StoryRailCreator = {
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        image:       string | null
    }
    stories: Array<{
        id:           string
        mediaUrl:     string | null
        thumbnailUrl: string | null
        mediaType:    string
        caption?:     string | null
        viewed:       boolean
        createdAt:    Date
    }>
    hasUnwatched: boolean
    latestAt:     Date
}

type Props = {
    streams:  LiveStream[]
    stories?: StoryRailCreator[]
}

export const LiveRail = ({ streams = [], stories = [] }: Props) => {
    // ── Live stream state: starts from SSR prop, removes on stream-ended event ──
    const [liveStreams, setLiveStreams] = useState<LiveStream[]>(streams)

    // ── Story viewer state ────────────────────────────────────────────────────
    const [activeStoryGroup, setActiveStoryGroup] = useState<StoryRailCreator | null>(null)
    const [storyIndex, setActiveStoryIndex]       = useState(0)
    // Track viewed stories optimistically
    const [viewedIds, setViewedIds] = useState<Set<string>>(
        () => new Set(stories.flatMap(g => g.stories.filter(s => s.viewed).map(s => s.id)))
    )

    const activeStory = activeStoryGroup?.stories[storyIndex]

    // ── Pusher: listen for stream-ended on every live creator ─────────────────
    useEffect(() => {
        if (liveStreams.length === 0) return

        const pusher   = getPusherClient()
        const channels = liveStreams.map((s) => {
            const channelName = `creator-${s.creator.id}-live`
            const ch = pusher.subscribe(channelName)
            ch.bind("stream-ended", () => {
                setLiveStreams((prev) => prev.filter((ls) => ls.creator.id !== s.creator.id))
            })
            return channelName
        })

        return () => {
            channels.forEach((name) => {
                const ch = pusher.channel(name)
                ch?.unbind_all()
                pusher.unsubscribe(name)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streams]) // re-subscribe only when the initial SSR prop changes

    // ── Story auto-advance timer ──────────────────────────────────────────────
    useEffect(() => {
        if (!activeStoryGroup || !activeStory) return

        recordStoryViewAction(activeStory.id)
            .then(() => setViewedIds((prev) => new Set([...prev, activeStory.id])))
            .catch(() => {})

        const timer = setTimeout(() => {
            if (storyIndex < activeStoryGroup.stories.length - 1) {
                setActiveStoryIndex((prev) => prev + 1)
            } else {
                handleCloseStory()
            }
        }, 5000)

        return () => clearTimeout(timer)
    }, [activeStoryGroup, activeStory?.id, storyIndex])

    const handleOpenStory = (group: StoryRailCreator) => {
        setActiveStoryGroup(group)
        setActiveStoryIndex(0)
    }

    const handleCloseStory = () => {
        setActiveStoryGroup(null)
        setActiveStoryIndex(0)
    }

    const handlePrevStory = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (storyIndex > 0) setActiveStoryIndex((prev) => prev - 1)
        else handleCloseStory()
    }

    const handleNextStory = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (activeStoryGroup && storyIndex < activeStoryGroup.stories.length - 1) {
            setActiveStoryIndex((prev) => prev + 1)
        } else {
            handleCloseStory()
        }
    }

    if (liveStreams.length === 0 && stories.length === 0) return null

    return (
        <>
            <div className="live-rail">
                <div className="live-rail__track">
                    {/* ── 1. Live Stream Broadcasts ── */}
                    {liveStreams.map((s) => (
                        <Link
                            key={`live-${s.id}`}
                            href={`/fan/live/${s.id}`}
                            className="live-bubble"
                            title={s.title}
                        >
                            <span className="live-bubble__ring">
                                <span className="live-bubble__avatar">
                                    {s.creator.user.image ? (
                                        <img
                                            src={s.creator.user.image}
                                            alt={s.creator.displayName}
                                            width={62}
                                            height={62}
                                        />
                                    ) : (
                                        <span className="live-bubble__fallback">
                                            {s.creator.displayName.charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </span>
                                <span className="live-bubble__tag">LIVE</span>
                            </span>

                            <span className="live-bubble__name">
                                {s.creator.handle ?? s.creator.displayName}
                            </span>
                        </Link>
                    ))}

                    {/* ── 2. Creator Stories ── */}
                    {stories.map((group) => {
                        const hasActive   = group.stories.length > 0
                        const isUnwatched = group.hasUnwatched ||
                            group.stories.some((s) => !viewedIds.has(s.id))
                        const imgUrl      = group.creator.image
                            || group.stories[0]?.thumbnailUrl
                            || group.stories[0]?.mediaUrl

                        if (!hasActive) return null

                        return (
                            <button
                                key={`story-${group.creator.id}`}
                                type="button"
                                className="story-bubble"
                                onClick={() => handleOpenStory(group)}
                                aria-label={`View ${group.creator.displayName}'s story`}
                            >
                                <span
                                    className={`story-bubble__ring${
                                        isUnwatched ? "" : " story-bubble__ring--viewed"
                                    }`}
                                >
                                    <span className="story-bubble__avatar">
                                        {imgUrl ? (
                                            <img
                                                src={imgUrl}
                                                alt={group.creator.displayName}
                                                width={62}
                                                height={62}
                                            />
                                        ) : (
                                            <span className="story-bubble__fallback">
                                                {group.creator.displayName.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </span>
                                </span>

                                <span className="story-bubble__name">
                                    {group.creator.handle ?? group.creator.displayName}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Story Viewer Modal ── */}
            {activeStoryGroup && activeStory && (
                <div className="story-viewer-modal" onClick={handleCloseStory}>
                    <div
                        className="story-viewer-modal__content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Media Display */}
                        {activeStory.mediaType === "VIDEO" && activeStory.mediaUrl ? (
                            <video
                                key={activeStory.id}
                                src={activeStory.mediaUrl}
                                className="story-viewer-modal__media"
                                autoPlay
                                muted
                                playsInline
                                loop={false}
                            />
                        ) : activeStory.mediaUrl ? (
                            <img
                                src={activeStory.mediaUrl}
                                alt="Story"
                                className="story-viewer-modal__media"
                            />
                        ) : null}

                        {/* Tap zones for prev/next */}
                        <button
                            type="button"
                            className="story-viewer-modal__tap-prev"
                            onClick={handlePrevStory}
                            aria-label="Previous story"
                        />
                        <button
                            type="button"
                            className="story-viewer-modal__tap-next"
                            onClick={handleNextStory}
                            aria-label="Next story"
                        />

                        {/* Top Bar */}
                        <div className="story-viewer-modal__top">
                            {/* Segmented Progress Bars */}
                            <div className="story-viewer-modal__progress">
                                {activeStoryGroup.stories.map((s, i) => (
                                    <div key={s.id} className="story-viewer-modal__bar">
                                        <div
                                            className="story-viewer-modal__bar-fill"
                                            style={{
                                                width: i < storyIndex ? "100%"
                                                    : i === storyIndex ? undefined
                                                    : "0%",
                                                // Only animate the active bar
                                                animation: i === storyIndex
                                                    ? "story-progress 5s linear forwards"
                                                    : "none",
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Creator Header */}
                            <div className="story-viewer-modal__header">
                                <div className="story-viewer-modal__creator">
                                    {activeStoryGroup.creator.image ? (
                                        <img
                                            src={activeStoryGroup.creator.image}
                                            alt={activeStoryGroup.creator.displayName}
                                        />
                                    ) : (
                                        <div className="story-viewer-modal__avatar-fallback">
                                            {activeStoryGroup.creator.displayName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div className="story-viewer-modal__creator-name">
                                            {activeStoryGroup.creator.displayName}
                                        </div>
                                        <div className="story-viewer-modal__time">
                                            {formatDistanceToNowStrict(new Date(activeStory.createdAt))} ago
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className="story-viewer-modal__close"
                                    onClick={handleCloseStory}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Caption */}
                        {activeStory.caption && (
                            <div className="story-viewer-modal__caption">
                                {activeStory.caption}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}