// components/fan/feed/LiveRail.tsx
"use client"

import Link from "next/link"

// Styles: .live-rail in Feed.scss

type LiveStream = {
    id:    string
    title: string
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
}

type Props = {
    streams: LiveStream[]
}

export const LiveRail = ({ streams }: Props) => {
    if (streams.length === 0) return null

    return (
        <div className="live-rail">
            <div className="live-rail__track">
                {streams.map((s) => (
                    <Link
                        key={s.id}
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
            </div>
        </div>
    )
}