import { redirect } from "next/navigation"

export default async function ExplorePage({
    searchParams,
}: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const resolved = searchParams ? await searchParams : {}
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(resolved)) {
        if (typeof value === "string") {
            params.set(key, value)
        } else if (Array.isArray(value)) {
            value.forEach((v) => params.append(key, v))
        }
    }
    const qs = params.toString()
    redirect(qs ? `/fan/discover?${qs}` : "/fan/discover")
}
