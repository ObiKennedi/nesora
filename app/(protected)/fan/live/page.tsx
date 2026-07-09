import { auth }                  from "@/lib/auth"
import { redirect }              from "next/navigation"
import { LiveGrid }              from "@/component/fan/feed/LiveGrid"
import { getFollowedLiveStreams } from "../feed/page"

export default async function LivePage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const streams = await getFollowedLiveStreams(session.user.id)

    return <LiveGrid streams={streams} />
}