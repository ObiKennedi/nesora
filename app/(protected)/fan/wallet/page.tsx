// app/(fan)/wallet/page.tsx
import { Suspense }                      from "react"
import { auth }                          from "@/lib/auth"
import { redirect }                      from "next/navigation"
import {
    getFanWalletAction,
    getFanTransactionHistoryAction,
}                                        from "@/actions/fan/wallet"
import { WalletPageClient }              from "@/component/fan/wallet/WalletPageClient"
import { Loader }                        from "@/component/essentials/Loader"

export default async function WalletPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const [wallet, history] = await Promise.all([
        getFanWalletAction(),
        getFanTransactionHistoryAction({ page: 1, filter: "all" }),
    ])

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading wallet…" />}>
            <WalletPageClient
                initialBalance={wallet.balance}
                initialTransactions={history.transactions}
                initialPages={history.pages}
            />
        </Suspense>
    )
}