import { auth }     from "@/lib/auth"
import { redirect } from "next/navigation"
import { getStreamForWatchAction } from "@/actions/fan/live"
import WatchClient from "@/component/fan/live/LiveClient"

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const { id } = await params
    const data = await getStreamForWatchAction(id)

    if ("error" in data) {
        return <div className="watch watch--error">Stream not found or no longer available.</div>
    }
    return <WatchClient data={data} currentUserId={session.user.id} />
}