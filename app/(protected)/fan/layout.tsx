// app/(fan)/layout.tsx
"use client"

import { useState, Suspense } from "react"
import { useSession }         from "next-auth/react"
import { FanTopBar }          from "@/component/fan/layout/FanTopBar"
import { FanSideNav }         from "@/component/fan/layout/FanSideNav"
import { FanBottomNav }       from "@/component/fan/layout/FanBottomNav"
import { WalletModal }        from "@/component/fan/wallet/WalletModal"
import { Loader }             from "@/component/essentials/Loader"
import { CallProvider }       from "@/component/calls/CallProvider"
import { MessagesProvider }   from "@/component/fan/messages/MessagesProvider"
import { ChatDock }           from "@/component/fan/messages/ChatDock"
import { FanThemeProvider }    from "@/component/fan/FanThemeContext"
import "@/styles/fan/FanLayout.scss"

export default function FanLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { data: session } = useSession()
    const [walletOpen, setWalletOpen] = useState(false)

    const userId = session?.user?.id ?? ""

    return (
        // CallProvider stays outermost and OUTSIDE Suspense — it subscribes to
        // `user-${id}` first, which MessagesProvider then shares.
        <CallProvider role="fan" currentUserId={userId}>
            <MessagesProvider currentUserId={userId}>
                <FanThemeProvider>
                    <div className="fan-shell">

                        {/* Desktop only */}
                        <FanSideNav onWalletOpen={() => setWalletOpen(true)} />

                        {/* Mobile only */}
                        <FanTopBar />

                        <main className="fan-content">
                            <Suspense fallback={<Loader />}>
                                {children}
                            </Suspense>
                        </main>

                        {/* Mobile only */}
                        <FanBottomNav onWalletOpen={() => setWalletOpen(true)} />

                        {/* Desktop only — persists across route changes */}
                        <ChatDock currentUserId={userId} />

                        {walletOpen && (
                            <WalletModal onClose={() => setWalletOpen(false)} />
                        )}

                    </div>
                </FanThemeProvider>
            </MessagesProvider>
        </CallProvider>
    )
}