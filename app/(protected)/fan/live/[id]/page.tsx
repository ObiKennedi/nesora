// app/(fan)/fan/live/[id]/page.tsx
import { auth }                    from "@/lib/auth"
import { redirect, notFound }      from "next/navigation"
import { getStreamForWatchAction } from "@/actions/fan/live"
import WatchClient                 from "@/component/fan/live/WatchClient"

export default async function WatchPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const { id } = await params
    const data = await getStreamForWatchAction(id)

    // The action returns either { error } or the success shape.
    if ("error" in data) notFound()

    return <WatchClient data={data} currentUserId={session.user.id} />
}