// components/fan/feed/FeedTopTabs.tsx
"use client"

import Link              from "next/link"
import { usePathname }   from "next/navigation"
import { Home, Clapperboard, Radio } from "lucide-react"

// Styles: .feed-toptabs in Feed.scss

const TABS = [
    { href: "/fan/feed",   label: "Feed",   icon: <Home         size={19} /> },
    { href: "/fan/shorts", label: "Shorts", icon: <Clapperboard size={19} /> },
    { href: "/fan/live",   label: "Live",   icon: <Radio        size={19} /> },
]

type Props = {
    liveCount?: number
}

export const FeedTopTabs = ({ liveCount = 0 }: Props) => {
    const pathname = usePathname()

    return (
        <nav className="feed-toptabs" aria-label="Feed sections">
            {TABS.map((tab) => {
                const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/")
                return (
                    <Link
                        key={tab.href}
                        href={tab.href}
                        className={`feed-toptabs__item ${isActive ? "feed-toptabs__item--active" : ""}`}
                    >
                        <span className="feed-toptabs__icon-wrap">
                            {tab.icon}
                            {tab.href === "/fan/live" && liveCount > 0 && (
                                <span className="feed-toptabs__dot" aria-hidden="true" />
                            )}
                        </span>
                        <span>{tab.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}