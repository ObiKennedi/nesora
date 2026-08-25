// components/fan/feed/LiveRail.tsx — Stories & Live Rail at Top of Feed
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { recordStoryViewAction } from "@/actions/stories"
import { formatDistanceToNowStrict } from "date-fns"

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
    const [activeStoryGroup, setActiveStoryGroup] = useState<StoryRailCreator | null>(null)
    const [storyIndex, setActiveStoryIndex]       = useState(0)

    const activeStory = activeStoryGroup?.stories[storyIndex]

    const handleOpenStory = (group: StoryRailCreator) => {
        setActiveStoryGroup(group)
        setActiveStoryIndex(0)
    }

    const handleCloseStory = () => {
        setActiveStoryGroup(null)
        setActiveStoryIndex(0)
    }

    useEffect(() => {
        if (!activeStoryGroup || !activeStory) return

        // Record story view
        recordStoryViewAction(activeStory.id).catch(() => {})

        // Timer for auto-advancing
        const timer = setTimeout(() => {
            if (storyIndex < activeStoryGroup.stories.length - 1) {
                setActiveStoryIndex((prev) => prev + 1)
            } else {
                handleCloseStory()
            }
        }, 5000)

        return () => clearTimeout(timer)
    }, [activeStoryGroup, activeStory?.id, storyIndex])

    if (streams.length === 0 && stories.length === 0) return null

    return (
        <>
            <div className="live-rail">
                <div className="live-rail__track">
                    {/* ── 1. Live Stream Broadcasts ── */}
                    {streams.map((s) => (
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
                        const isUnwatched = group.hasUnwatched
                        const firstStory  = group.stories[0]
                        const imgUrl      = group.creator.image || firstStory?.thumbnailUrl || firstStory?.mediaUrl

                        return (
                            <button
                                key={`story-${group.creator.id}`}
                                type="button"
                                className="story-bubble"
                                onClick={() => handleOpenStory(group)}
                            >
                                <span
                                    className={`story-bubble__ring ${
                                        !isUnwatched ? "story-bubble__ring--viewed" : ""
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
                        {activeStory.mediaUrl ? (
                            <img
                                src={activeStory.mediaUrl}
                                alt="Story"
                                className="story-viewer-modal__media"
                            />
                        ) : null}

                        {/* Top Bar */}
                        <div className="story-viewer-modal__top">
                            {/* Segmented Progress Bars */}
                            <div className="story-viewer-modal__progress">
                                {activeStoryGroup.stories.map((s, i) => (
                                    <div key={s.id} className="story-viewer-modal__bar">
                                        <div
                                            className="story-viewer-modal__bar-fill"
                                            style={{
                                                width: i <= storyIndex ? "100%" : "0%",
                                                transition: i === storyIndex ? "width 5s linear" : "none",
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