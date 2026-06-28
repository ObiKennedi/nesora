import { Suspense }                    from "react"
import { auth }                        from "@/lib/auth"
import { redirect }                    from "next/navigation"
import { getDiscoverCreatorsAction }   from "@/actions/fan/discover"
import { DiscoverClient }              from "@/component/fan/discover/DiscoverClient"
import { CATEGORIES }                  from "@/lib/categories"
import { Loader }                      from "@/component/essentials/Loader"

export const metadata = {
    title: "Discover Creators | NESORA",
}

export default async function DiscoverPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const data = await getDiscoverCreatorsAction({ page: 1 })

    // Build label map from shared CATEGORIES constant
    const categoryLabels: Record<string, { label: string; emoji: string }> = {}
    for (const cat of CATEGORIES) {
        categoryLabels[cat.value] = { label: cat.label, emoji: cat.emoji }
    }

    return (
        <Suspense fallback={<Loader fullscreen={false} message="Finding creators for you..." />}>
            <DiscoverClient
                initialCreators={data.creators}
                initialTotal={data.total}
                initialPages={data.pages}
                rankedCategories={data.categories}
                categoryLabels={categoryLabels}
            />
        </Suspense>
    )
}
