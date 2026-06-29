import { notFound } from "next/navigation"
import { getPublicCreatorProfile } from "@/lib/data/creator-profile"
import { ProfileView } from "@/component/profile/ProfileView"

export default async function PublicProfilePage({
    params,
}: {
    params: Promise<{ handle: string }>   // Next 15 — params is a Promise
}) {
    const { handle } = await params
    const profile = await getPublicCreatorProfile(handle)

    if (!profile) notFound()

    return <ProfileView profile={profile} />
}