// components/fan/feed/FeedSideNav.tsx
"use client"

import {
    Home,
    Clapperboard,
    Radio,
    MessageCircle
} from "lucide-react"
import "@/styles/fan/FeedSideNav.scss"

export type FeedTab = "feed" | "shorts" | "live" | "chat"

type Props = {
    activeTab:   FeedTab
    onTabChange: (tab: FeedTab) => void
    liveCount:   number
}

const TABS: { tab: FeedTab; label: string; icon: React.ReactNode }[] = [
    { tab: "feed",   label: "Feed",   icon: <Home        size={20} /> },
    { tab: "shorts", label: "Shorts", icon: <Clapperboard size={20} /> },
    { tab: "live",   label: "Live",   icon: <Radio       size={20} /> },
    { tab: "chat",   label: "Chat",   icon: <MessageCircle  size={20} />}
]

export const FeedSideNav = ({ activeTab, onTabChange, liveCount }: Props) => {
    return (
        <aside className="feed-sidenav">
            {TABS.map(({ tab, label, icon }) => (
                <button
                    key={tab}
                    type="button"
                    className={`feed-sidenav__item ${activeTab === tab ? "feed-sidenav__item--active" : ""}`}
                    onClick={() => onTabChange(tab)}
                >
                    <span className="feed-sidenav__icon-wrap">
                        {icon}
                        {tab === "live" && liveCount > 0 && (
                            <span className="feed-sidenav__badge">{liveCount}</span>
                        )}
                    </span>

                    <span className="feed-sidenav__label">{label}</span>

                    {tab === "live" && liveCount > 0 && (
                        <span className="feed-sidenav__live-dot" aria-label="Live now" />
                    )}
                </button>
            ))}
        </aside>
    )
}