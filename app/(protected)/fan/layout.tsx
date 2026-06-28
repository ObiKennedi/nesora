// app/(fan)/layout.tsx
"use client"

import { useState }       from "react"
import { FanTopBar }      from "@/component/fan/layout/FanTopBar"
import { FanBottomNav }   from "@/component/fan/layout/FanBottomNav"
import { WalletModal }    from "@/component/fan/wallet/WalletModal"
import { Suspense }       from "react"
import { Loader }         from "@/component/essentials/Loader"
import "@/styles/fan/FanLayout.scss"

export default function FanLayout({
    children,
}: {
    children: React.ReactNode
}) {
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

            {walletOpen && (
                <WalletModal onClose={() => setWalletOpen(false)} />
            )}

        </div>
    )
}