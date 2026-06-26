// components/fan/layout/FanTopBar.tsx
"use client"

import Link                   from "next/link"
import Image                  from "next/image"
import { Search }             from "lucide-react"
import { NotificationsBell }  from "@/component/creator/layout/NotificationsBell"
import "@/styles/fan/FanLayout.scss"

export const FanTopBar = () => {
    return (
        <header className="fan-topbar">
            {/* Logo */}
            <Link href="/feed" className="fan-topbar__logo">
                <img
                    src="/logo.png"
                    alt="NESORA"
                    width={100}
                    height={26}
                />
            </Link>

            {/* Right actions */}
            <div className="fan-topbar__right">
                <Link href="/explore?search=1" className="fan-topbar__icon-btn" aria-label="Search">
                    <Search size={20} />
                </Link>

                {/* Reuse the creator notifications bell — same Notification model */}
                <NotificationsBell />
            </div>
        </header>
    )
}