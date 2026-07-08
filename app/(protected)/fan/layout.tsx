// app/(fan)/layout.tsx
"use client"

import { useState, Suspense } from "react"
import { useSession }     from "next-auth/react"
import { FanTopBar }      from "@/component/fan/layout/FanTopBar"
import { FanBottomNav }   from "@/component/fan/layout/FanBottomNav"
import { WalletModal }    from "@/component/fan/wallet/WalletModal"
import { Loader }         from "@/component/essentials/Loader"
import { CallProvider }   from "@/component/calls/CallProvider"
import "@/styles/fan/FanLayout.scss"

export default function FanLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { data: session } = useSession()
    const [walletOpen, setWalletOpen] = useState(false)

    return (
        <CallProvider role="fan" currentUserId={session?.user?.id ?? ""}>
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
        </CallProvider>
    )
}