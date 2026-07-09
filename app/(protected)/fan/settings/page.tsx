// app/(fan)/settings/page.tsx
import { Suspense }             from "react"
import { auth }                 from "@/lib/auth"
import { redirect }             from "next/navigation"
import { getFanSettingsAction } from "@/actions/fan/settings"
import { FanSettingsClient }    from "@/component/fan/settings/FanSettingsClient"
import { Loader }               from "@/component/essentials/Loader"

export default async function FanSettingsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const data = await getFanSettingsAction()

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading settings…" />}>
            <FanSettingsClient
                user={data.user}
                interests={data.interests}
                isGoogleAccount={data.isGoogleAccount}
                hasPassword={data.hasPassword}
                isCreator={data.isCreator}
            />
        </Suspense>
    )
}