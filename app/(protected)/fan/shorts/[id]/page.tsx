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

    // Short not in the first page of the pool — fall back to the top of the reel.
    // (A dedicated getShortByIdAction would let us prepend it instead.)
    if (data.shorts.length === 0) redirect("/fan/shorts")

    return (
        <ShortsPlayer
            initialShorts={data.shorts as any}
            startIndex={startIndex >= 0 ? startIndex : 0}
        />
    )
}