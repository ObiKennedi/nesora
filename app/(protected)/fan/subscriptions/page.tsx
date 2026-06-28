// app/(fan)/subscriptions/page.tsx
import { Suspense }                         from "react"
import { auth }                             from "@/lib/auth"
import { redirect }                         from "next/navigation"
import {
    getFanSubscriptionsAction,
    getFollowedNotSubscribedAction,
}                                           from "@/actions/fan/subscription"
import { SubscriptionsClient }              from "@/component/fan/subscriptions/SubscriptionsClient"
import { Loader }                           from "@/component/essentials/Loader"

export default async function SubscriptionsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const [subscriptions, suggested] = await Promise.all([
        getFanSubscriptionsAction(),
        getFollowedNotSubscribedAction(),
    ])

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading subscriptions…" />}>
            <SubscriptionsClient
                initialSubscriptions={subscriptions}
                initialSuggested={suggested}
                currentUserId={session.user.id}
            />
        </Suspense>
    )
}