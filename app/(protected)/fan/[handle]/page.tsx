// app/(fan)/[handle]/page.tsx

import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
    getPublicCreatorProfileAction,
    getCreatorGridPostsAction,
} from "@/actions/creator-profile"
import CreatorProfileView from "@/component/creator-profile/CreatorProfileView"

type Params = Promise<{ handle: string }>

function extractHandle(raw: string): string | null {
    const decoded = decodeURIComponent(raw)
    if (!decoded.startsWith("@")) return null
    const handle = decoded.slice(1)
    return handle.length > 0 ? handle : null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { handle: raw } = await params
    const handle = extractHandle(raw)
    if (!handle) return {}

    const profile = await getPublicCreatorProfileAction(handle)
    if (profile.status !== "success") return {}

    const { creator } = profile
    return {
        title:       `${creator.displayName} (@${creator.handle}) | Nesora`,
        description: creator.bio ?? `Follow ${creator.displayName} on Nesora`,
        openGraph: {
            title:       `${creator.displayName} (@${creator.handle})`,
            description: creator.bio ?? undefined,
            images:      creator.image ? [creator.image] : undefined,
        },
    }
}

export default async function PublicCreatorProfilePage({ params }: { params: Params }) {
    const { handle: raw } = await params
    const handle = extractHandle(raw)
    if (!handle) notFound()

    const profile = await getPublicCreatorProfileAction(handle)
    if (profile.status !== "success") notFound()

    const initialGrid = await getCreatorGridPostsAction({
        handle,
        tab:    "posts",
        cursor: null,
    })

    return (
        <CreatorProfileView
            creator={profile.creator}
            viewer={profile.viewer}
            initialPosts={initialGrid.status === "success" ? initialGrid.posts : []}
            initialCursor={initialGrid.status === "success" ? initialGrid.nextCursor : null}
        />
    )
}