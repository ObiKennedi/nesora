import { auth }            from "@/lib/auth"
import { redirect }        from "next/navigation"
import { getShortsAction } from "@/actions/fan/feed"
import { ShortsPlayer }    from "@/component/fan/feed/ShortsPlayer"

export default async function ShortsPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const data = await getShortsAction({ page: 1, limit: 10 })

    if (data.shorts.length === 0) {
        return (
            <div className="shorts-empty">
                <p>No shorts yet</p>
                <p>Follow creators to see their shorts here.</p>
            </div>
        )
    }

    return <ShortsPlayer initialShorts={data.shorts as any} startIndex={0} currentUserId={session.user.id} />
}