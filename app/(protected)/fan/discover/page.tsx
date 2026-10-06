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

type PageProps = {
    searchParams?: Promise<{ search?: string; q?: string; category?: string; focus?: string }>
}

export default async function DiscoverPage({ searchParams }: PageProps) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const resolved = searchParams ? await searchParams : {}
    const query = resolved.search && resolved.search !== "1"
        ? resolved.search
        : resolved.q && resolved.q !== "1"
            ? resolved.q
            : undefined

    const shouldFocus = resolved.search === "1" || resolved.focus === "1"

    const data = await getDiscoverCreatorsAction({
        page:     1,
        search:   query,
        category: (resolved.category as any) || undefined,
    })

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
                initialSearch={query ?? ""}
                autoFocusSearch={shouldFocus}
            />
        </Suspense>
    )
}
