// app/(fan)/fan/[username]/page.tsx

import { notFound } from "next/navigation"
import type { Metadata } from "next"
import {
    getPublicCreatorProfileAction,
    getCreatorGridPostsAction,
} from "@/actions/creator-profile"
import CreatorProfileView from "@/component/creator-profile/CreatorProfileView"

type Params = Promise<{ username: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { username: raw } = await params
    const identifier = decodeURIComponent(raw)

    const profile = await getPublicCreatorProfileAction(identifier)
    if (profile.status !== "success") return {}

    const { creator } = profile
    return {
        title:       `${creator.displayName} (@${creator.username}) | Nesora`,
        description: creator.bio ?? `Follow ${creator.displayName} on Nesora`,
        openGraph: {
            title:       `${creator.displayName} (@${creator.username})`,
            description: creator.bio ?? undefined,
            images:      creator.image ? [creator.image] : undefined,
        },
    }
}

export default async function PublicCreatorProfilePage({ params }: { params: Params }) {
    const { username: raw } = await params
    const identifier = decodeURIComponent(raw)

    const profile = await getPublicCreatorProfileAction(identifier)
    if (profile.status !== "success") notFound()

    const initialGrid = await getCreatorGridPostsAction({
        identifier: profile.creator.username, // canonicalize even if reached via id
        tab:        "posts",
        cursor:     null,
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