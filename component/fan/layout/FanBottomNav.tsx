// components/fan/layout/FanBottomNav.tsx
"use client"

import Link               from "next/link"
import { usePathname }    from "next/navigation"
import { Plus }           from "lucide-react"
import { FAN_BOTTOM_NAV } from "./fan-nav-config"
import { useMessages }    from "@/component/fan/messages/MessagesProvider"
import "@/styles/fan/FanLayout.scss"

type Props = {
    onWalletOpen: () => void
}

export const FanBottomNav = ({ onWalletOpen }: Props) => {
    const pathname = usePathname()
    const { unreadCount } = useMessages()

    const [left, right] = [FAN_BOTTOM_NAV.slice(0, 2), FAN_BOTTOM_NAV.slice(2)]

    const renderItem = (item: (typeof FAN_BOTTOM_NAV)[number]) => {
        const isActive  = pathname === item.href || pathname.startsWith(item.href + "/")
        const showBadge = item.badge === "unread" && unreadCount > 0

        return (
            <Link
                key={item.href}
                href={item.href}
                className={`fan-footnav__item ${isActive ? "fan-footnav__item--active" : ""}`}
            >
                <span className="fan-footnav__icon-wrap">
                    {item.icon}
                    {showBadge && (
                        <span className="fan-footnav__badge">
                            {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                    )}
                </span>
                <span>{item.label}</span>
            </Link>
        )
    }

    return (
        <nav className="fan-footnav" aria-label="Fan navigation">

            {left.map(renderItem)}

            {/* Centre wallet action */}
            <button
                type="button"
                className="fan-footnav__wallet-btn"
                onClick={onWalletOpen}
                aria-label="Top up wallet"
            >
                <span className="fan-footnav__wallet-inner">
                    <Plus size={24} strokeWidth={2.5} />
                </span>
            </button>

            {right.map(renderItem)}

        </nav>
    )
}