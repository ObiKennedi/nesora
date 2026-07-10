// components/fan/feed/LiveGrid.tsx
"use client"

import Link      from "next/link"
import { Radio } from "lucide-react"

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

export function LiveGrid({ streams }: { streams: LiveStream[] }) {
    if (streams.length === 0) {
        return (
            <div className="feed-live-soon">
                <div className="feed-live-soon__icon"><Radio size={40} /></div>
                <h3>No one&rsquo;s live right now</h3>
                <p>When creators you follow go live, they&rsquo;ll show up here.</p>
            </div>
        )
    }

    return (
        <div className="live-grid">
            {streams.map((s) => (
                <Link key={s.id} href={`/fan/live/${s.id}`} className="live-grid__card">
                    <div className="live-grid__thumb">
                        {s.creator.user.image
                            ? <img src={s.creator.user.image} alt={s.creator.displayName} />
                            : <span className="live-grid__thumb-fallback">{s.creator.displayName[0]}</span>}
                        <span className="live-grid__badge">● LIVE</span>
                    </div>

                    <div className="live-grid__info">
                        <span className="live-grid__title">{s.title}</span>
                        <span className="live-grid__creator">{s.creator.displayName}</span>
                    </div>
                </Link>
            ))}
        </div>
    )
}