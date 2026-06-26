// components/fan/layout/FanBottomNav.tsx
"use client"

import Link                from "next/link"
import { usePathname }     from "next/navigation"
import { Plus }            from "lucide-react"
import { FAN_BOTTOM_NAV }  from "./fan-nav-config"
import "@/styles/fan/FanLayout.scss"

type Props = {
    onWalletOpen: () => void
}

export const FanBottomNav = ({ onWalletOpen }: Props) => {
    const pathname = usePathname()

    // Split nav into left pair and right pair around centre "+" slot
    const [left, right] = [FAN_BOTTOM_NAV.slice(0, 2), FAN_BOTTOM_NAV.slice(2)]

    return (
        <nav className="fan-footnav" aria-label="Fan navigation">

            {/* Left two tabs */}
            {left.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`fan-footnav__item ${isActive ? "fan-footnav__item--active" : ""}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </Link>
                )
            })}

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

            {/* Right two tabs */}
            {right.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`fan-footnav__item ${isActive ? "fan-footnav__item--active" : ""}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </Link>
                )
            })}

        </nav>
    )
}