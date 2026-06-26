// components/fan/feed/ShortsRail.tsx
"use client"

import Image from "next/image"
import { Play, Lock } from "lucide-react"
import "@/styles/fan/ShortsRail.scss"

type Short = {
    id:            string
    title:         string | null
    thumbnailUrl:  string | null
    videoDuration: number | null
    hasAccess:     boolean
    creator: {
        displayName: string
        handle:      string | null
        image:       string | null
        id:          string
    }
}

type Props = {
    shorts:         Short[]
    onShortClick:   (shortId: string) => void
    onSeeAll:       () => void
}

function fmtDuration(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, "0")}`
}

export const ShortsRail = ({ shorts, onShortClick, onSeeAll }: Props) => {
    if (shorts.length === 0) return null

    return (
        <div className="shorts-rail">
            <div className="shorts-rail__header">
                <span className="shorts-rail__title">Shorts</span>
                <button
                    type="button"
                    className="shorts-rail__see-all"
                    onClick={onSeeAll}
                >
                    See all →
                </button>
            </div>

            <div className="shorts-rail__track">
                {shorts.map((short) => (
                    <button
                        key={short.id}
                        type="button"
                        className="short-card"
                        onClick={() => onShortClick(short.id)}
                    >
                        <div className="short-card__thumb">
                            {short.thumbnailUrl ? (
                                <img
                                    src={short.thumbnailUrl}
                                    alt={short.title ?? "Short"}
                                    sizes="120px"
                                    className={`short-card__img ${!short.hasAccess ? "short-card__img--blur" : ""}`}
                                />
                            ) : (
                                <div className="short-card__placeholder" />
                            )}

                            {!short.hasAccess && (
                                <div className="short-card__lock"><Lock size={14} /></div>
                            )}
                            {short.hasAccess && (
                                <div className="short-card__play"><Play size={14} fill="white" /></div>
                            )}
                            {short.videoDuration && (
                                <span className="short-card__duration">
                                    {fmtDuration(short.videoDuration)}
                                </span>
                            )}
                        </div>

                        <div className="short-card__meta">
                            <div className="short-card__avatar">
                                {short.creator.image ? (
                                    <img
                                        src={short.creator.image}
                                        alt={short.creator.displayName}
                                        width={20} height={20}
                                        className="short-card__avatar-img"
                                    />
                                ) : (
                                    <span className="short-card__avatar-fallback">
                                        {short.creator.displayName.charAt(0)}
                                    </span>
                                )}
                            </div>
                            <span className="short-card__creator">{short.creator.displayName}</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    )
}