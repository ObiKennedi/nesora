import { auth }            from "@/lib/auth"
import { redirect }        from "next/navigation"
import { getShortsAction } from "@/actions/fan/feed"
import { ShortsPlayer }    from "@/component/fan/feed/ShortsPlayer"

export default async function ShortPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const { id } = await params
    const data   = await getShortsAction({ page: 1, limit: 20 })

    const startIndex = data.shorts.findIndex((s) => s.id === id)

    if (data.shorts.length === 0) redirect("/fan/shorts")

    return (
        <ShortsPlayer
            initialShorts={data.shorts as any}
            currentUserId={session.user.id}
            startIndex={startIndex >= 0 ? startIndex : 0}
        />
    )
}