// components/fan/layout/FanSideNav.tsx
"use client"

import Link                  from "next/link"
import { usePathname }       from "next/navigation"
import { Plus }              from "lucide-react"
import { FAN_SIDE_NAV }      from "./fan-nav-config"
import { NotificationsBell } from "@/component/creator/layout/NotificationsBell"
import "@/styles/fan/FanLayout.scss"

type Props = {
    onWalletOpen: () => void
    liveCount?:   number
    unreadCount?: number
}

export const FanSideNav = ({ onWalletOpen, liveCount = 0, unreadCount = 0 }: Props) => {
    const pathname = usePathname()

    const badgeFor = (badge?: "live" | "unread") => {
        if (badge === "live")   return liveCount
        if (badge === "unread") return unreadCount
        return 0
    }

    return (
        <aside className="fan-sidenav">

            {/* Logo */}
            <Link href="/fan/feed" className="fan-sidenav__logo">
                <img src="/logo.png" alt="NESORA" width={110} height={28} />
            </Link>

            {/* Nav */}
            <nav className="fan-sidenav__nav" aria-label="Fan navigation">
                {FAN_SIDE_NAV.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                    const count    = badgeFor(item.badge)

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`fan-sidenav__item ${isActive ? "fan-sidenav__item--active" : ""}`}
                        >
                            <span className="fan-sidenav__icon-wrap">
                                {item.icon}
                                {count > 0 && (
                                    <span className="fan-sidenav__badge">
                                        {count > 99 ? "99+" : count}
                                    </span>
                                )}
                            </span>

                            <span className="fan-sidenav__label">{item.label}</span>

                            {item.badge === "live" && count > 0 && (
                                <span className="fan-sidenav__live-dot" aria-label="Live now" />
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Footer actions */}
            <div className="fan-sidenav__footer">
                <button
                    type="button"
                    className="fan-sidenav__wallet"
                    onClick={onWalletOpen}
                >
                    <span className="fan-sidenav__wallet-icon">
                        <Plus size={18} strokeWidth={2.5} />
                    </span>
                    <span className="fan-sidenav__label">Top up wallet</span>
                </button>

                <div className="fan-sidenav__bell">
                    <NotificationsBell />
                </div>
            </div>

        </aside>
    )
}