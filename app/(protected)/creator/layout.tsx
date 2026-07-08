// app/(creator)/layout.tsx
"use client"

import { useState, Suspense } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { CreatorSidebar } from "@/component/creator/layout/CreatorSidebar"
import { CreatorHeader } from "@/component/creator/layout/CreatorHeader"
import { CreatorFootNav } from "@/component/creator/layout/CreatorFootNav"
import { getPageTitle } from "@/component/creator/layout/nav-config"
import { Loader } from "@/component/essentials/Loader"
import { CallProvider } from "@/component/calls/CallProvider"
import "@/styles/creator/CreatorLayout.scss"

export default function CreatorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const { data: session } = useSession()
    const [menuOpen, setMenuOpen] = useState(false)
    const pageTitle = getPageTitle(pathname)

    return (
        <CallProvider role="creator" currentUserId={session?.user?.id ?? ""}>
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
                        <Suspense fallback={<Loader />}>
                            {children}
                        </Suspense>
                    </main>
                </div>

                <CreatorFootNav />

            </div>
        </CallProvider>
    )
}