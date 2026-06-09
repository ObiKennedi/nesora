// app/(creator)/layout.tsx
"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { CreatorSidebar } from "@/component/creator/layout/CreatorSidebar"
import { CreatorHeader } from "@/component/creator/layout/CreatorHeader"
import { CreatorFootNav } from "@/component/creator/layout/CreatorFootNav"
import { getPageTitle } from "@/component/creator/layout/nav-config"
import "@/styles/creator/CreatorLayout.scss"

export default function CreatorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const [menuOpen, setMenuOpen] = useState(false)
    const pageTitle = getPageTitle(pathname)

    return (
        <div className="creator-shell">

            <CreatorSidebar
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
            />

            {menuOpen && (
                <div
                    className="creator-backdrop"
                    onClick={() => setMenuOpen(false)}
                    aria-hidden="true"
                />
            )}

            <div className="creator-main">
                <CreatorHeader
                    pageTitle={pageTitle}
                    onMenuOpen={() => setMenuOpen(true)}
                />
                <main className="creator-content">
                    {children}
                </main>
            </div>

            <CreatorFootNav />

        </div>
    )
}