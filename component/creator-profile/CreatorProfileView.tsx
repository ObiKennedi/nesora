// component/creator-profile/CreatorProfileView.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BadgeCheck, Link as LinkIcon, Check, Loader2 } from "lucide-react"
import {
    toggleFollowAction,
    type PublicProfileCreator,
    type PublicProfileViewer,
    type GridPost,
} from "@/actions/creator-profile"
import ProfileGrid from "./ProfileGrid"
import SubscribeModal from "./SubscribeModal"
import "@/styles/creator-profile/creator-profile.scss"

type Props = {
    creator:       PublicProfileCreator
    viewer:        PublicProfileViewer
    initialPosts:  GridPost[]
    initialCursor: string | null
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
    return `${n}`
}

function displayUrl(url: string): string {
    try {
        const u = new URL(url)
        return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "")
    } catch {
        return url
    }
}

export default function CreatorProfileView({ creator, viewer, initialPosts, initialCursor }: Props) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    const [following, setFollowing]           = useState(viewer.isFollowing)
    const [followersCount, setFollowersCount] = useState(creator.followersCount)
    const [showSubscribe, setShowSubscribe]   = useState(false)

    const profilePath = `/fan/${creator.username}`

    const handleFollow = () => {
        if (!viewer.isAuthenticated) {
            router.push(`/login?next=${encodeURIComponent(profilePath)}`)
            return
        }

        // Optimistic flip; reconciled with the server's authoritative count
        const optimistic = !following
        setFollowing(optimistic)
        setFollowersCount((c) => c + (optimistic ? 1 : -1))

        startTransition(async () => {
            const result = await toggleFollowAction(creator.id)

            if (result.status === "success") {
                setFollowing(result.following)
                setFollowersCount(result.followersCount)
            } else {
                // Roll back
                setFollowing(!optimistic)
                setFollowersCount((c) => c + (optimistic ? -1 : 1))
                if (result.status === "unauthenticated") {
                    router.push(`/login?next=${encodeURIComponent(profilePath)}`)
                }
            }
        })
    }

    const handleSubscribeClick = () => {
        if (!viewer.isAuthenticated) {
            router.push(`/login?next=${encodeURIComponent(profilePath)}`)
            return
        }
        setShowSubscribe(true)
    }

    const canSubscribe =
        creator.subscriptionEnabled && creator.plans.length > 0 && !viewer.isOwnProfile

    return (
        <div className="creator-profile">
            {/* ── Banner ── */}
            <div
                className="creator-profile__banner"
                style={
                    creator.bannerImage
                        ? { backgroundImage: `url(${creator.bannerImage})` }
                        : { background: `linear-gradient(135deg, ${creator.accentColor ?? "#c2622a"}22, ${creator.accentColor ?? "#c2622a"})` }
                }
            />

            {/* ── Head ── */}
            <div className="creator-profile__head">
                <div className="creator-profile__avatar">
                    {creator.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={creator.image} alt={creator.displayName} />
                    ) : (
                        <span className="creator-profile__avatar-fallback">
                            {creator.displayName.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>

                <h1 className="creator-profile__name">
                    {creator.displayName}
                    {creator.isVerified && (
                        <BadgeCheck className="creator-profile__badge" size={22} aria-label="Verified" />
                    )}
                </h1>

                <p className="creator-profile__handle">@{creator.username}</p>

                {creator.bio && <p className="creator-profile__bio">{creator.bio}</p>}

                {creator.websiteUrl && (
                    <a
                        className="creator-profile__website"
                        href={creator.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <LinkIcon size={14} />
                        {displayUrl(creator.websiteUrl)}
                    </a>
                )}

                {/* ── Stats ── */}
                <div className="creator-profile__stats">
                    <div className="creator-profile__stat">
                        <span className="creator-profile__stat-value">{formatCount(creator.postsCount)}</span>
                        <span className="creator-profile__stat-label">Posts</span>
                    </div>
                    <div className="creator-profile__stat">
                        <span className="creator-profile__stat-value">{formatCount(followersCount)}</span>
                        <span className="creator-profile__stat-label">Followers</span>
                    </div>
                    <div className="creator-profile__stat">
                        <span className="creator-profile__stat-value">{formatCount(creator.subscribersCount)}</span>
                        <span className="creator-profile__stat-label">Subscribers</span>
                    </div>
                </div>

                {/* ── Actions ── */}
                <div className="creator-profile__actions">
                    {viewer.isOwnProfile ? (
                        <Link href="/creator/profile" className="creator-profile__btn creator-profile__btn--secondary">
                            Edit profile
                        </Link>
                    ) : (
                        <>
                            <button
                                type="button"
                                className={`creator-profile__btn ${following ? "creator-profile__btn--secondary" : "creator-profile__btn--outline"}`}
                                onClick={handleFollow}
                                disabled={isPending}
                            >
                                {isPending ? (
                                    <Loader2 size={16} className="creator-profile__spinner" />
                                ) : following ? (
                                    <>
                                        <Check size={16} /> Following
                                    </>
                                ) : (
                                    "Follow"
                                )}
                            </button>

                            {canSubscribe && (
                                viewer.isSubscribed ? (
                                    <span className="creator-profile__btn creator-profile__btn--subscribed">
                                        <Check size={16} /> Subscribed
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="creator-profile__btn creator-profile__btn--primary"
                                        onClick={handleSubscribeClick}
                                    >
                                        Subscribe
                                    </button>
                                )
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Grid ── */}
            <ProfileGrid
                username={creator.username}
                initialPosts={initialPosts}
                initialCursor={initialCursor}
                onLockedClick={canSubscribe && !viewer.isSubscribed ? handleSubscribeClick : undefined}
            />

            {/* ── Subscribe modal ── */}
            {showSubscribe && (
                <SubscribeModal
                    creatorId={creator.id}
                    creatorName={creator.displayName}
                    plans={creator.plans}
                    onClose={() => setShowSubscribe(false)}
                    onSubscribed={() => {
                        setShowSubscribe(false)
                        router.refresh()
                    }}
                />
            )}
        </div>
    )
}