"use client"

import { useState }       from "react"
import { FanTopBar }      from "@/component/fan/layout/FanTopBar"
import { FanBottomNav }   from "@/component/fan/layout/FanBottomNav"
import { Suspense }       from "react"
import { Loader }         from "@/component/essentials/Loader"
import "@/styles/fan/FanLayout.scss"

export default function FanLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Wallet top-up modal state — passed down to bottom nav, modal built later
    const [walletOpen, setWalletOpen] = useState(false)

    return (
        <div className="fan-shell">

            <FanTopBar />

            <main className="fan-content">
                <Suspense fallback={<Loader />}>
                    {children}
                </Suspense>
            </main>

            <FanBottomNav onWalletOpen={() => setWalletOpen(true)} />

            {/* Wallet top-up modal placeholder — wired up when wallet actions are built */}
            {walletOpen && (
                <div
                    className="fan-modal-backdrop"
                    onClick={() => setWalletOpen(false)}
                    aria-hidden="true"
                />
            )}

        </div>
    )
}