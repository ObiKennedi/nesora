// app/(fan)/billing/page.tsx — Web Billing & Subscription Plans Page
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import {
    getMembershipStatusAction,
    getFanSubscriptionsAction,
    getBillingHistoryAction,
} from "@/actions/fan/subscription"
import { getFanWalletAction } from "@/actions/fan/wallet"
import { BillingClient } from "@/component/fan/billing/BillingClient"
import { Loader } from "@/component/essentials/Loader"

export const metadata = {
    title: "Billing & Subscriptions · NESORA",
    description: "Manage your NESORA Plus platform membership and creator subscriptions.",
}

export default async function BillingPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const [membership, subscriptions, wallet, history] = await Promise.all([
        getMembershipStatusAction(),
        getFanSubscriptionsAction(),
        getFanWalletAction(),
        getBillingHistoryAction(),
    ])

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading billing details…" />}>
            <BillingClient
                membership={membership}
                subscriptions={subscriptions}
                walletBalance={wallet.balance}
                billingHistory={history}
            />
        </Suspense>
    )
}
