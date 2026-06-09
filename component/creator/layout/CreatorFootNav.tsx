// components/creator/layout/CreatorFootNav.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MOBILE_NAV } from "./nav-config"

export const CreatorFootNav = () => {
    const pathname = usePathname()

    return (
        <nav className="creator-footnav" aria-label="Mobile navigation">
            {MOBILE_NAV.map((item) => {
                const base = item.href!.split("/").slice(0, 3).join("/")
                const isActive = pathname === item.href || pathname.startsWith(base)
                return (
                    <Link
                        key={item.href}
                        href={item.href!}
                        className={`creator-footnav__item ${isActive ? "creator-footnav__item--active" : ""}`}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}