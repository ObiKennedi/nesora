// components/fan/feed/FeedRightRail.tsx
"use client"

import { useState, useTransition } from "react"
import Link                        from "next/link"
import { BadgeCheck }              from "lucide-react"
import {
    followCreatorAction,
    unfollowCreatorAction,
} from "@/actions/fan/discover"

export type RailCreator = {
    id:             string
    displayName:    string
    handle:         string | null
    image:          string | null
    isVerified:     boolean
    followersCount: number
    isFollowing:    boolean
}

type Props = {
    suggested: RailCreator[]
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

export const FeedRightRail = ({ suggested }: Props) => {
    const [creators,    setCreators]    = useState<RailCreator[]>(suggested)
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
    const [,            startTransition] = useTransition()

    const handleToggleFollow = (id: string, isFollowing: boolean) => {
        setCreators((prev) =>
            prev.map((c) => c.id === id ? { ...c, isFollowing: !isFollowing } : c)
        )
        setTogglingIds((prev) => new Set(prev).add(id))

        startTransition(async () => {
            const action = isFollowing ? unfollowCreatorAction : followCreatorAction
            const res    = await action(id)

            if (!res.success) {
                setCreators((prev) =>
                    prev.map((c) => c.id === id ? { ...c, isFollowing } : c)
                )
            }

            setTogglingIds((prev) => {
                const next = new Set(prev)
                next.delete(id)
                return next
            })
        })
    }

    if (creators.length === 0) return null

    return (
        <aside className="feed-rail">
            <div className="rail-card">
                <div className="rail-card__header">
                    <span className="rail-card__title">Suggested for you</span>
                    <Link href="/fan/discover" className="rail-card__see-all">
                        See all
                    </Link>
                </div>

                <div className="rail-card__list">
                    {creators.slice(0, 5).map((c) => (
                        <div key={c.id} className="rail-creator">
                            <Link
                                href={`/fan/${c.handle ?? c.id}`}
                                className="rail-creator__link"
                            >
                                <div className="rail-creator__avatar">
                                    {c.image ? (
                                        <img
                                            src={c.image}
                                            alt={c.displayName}
                                            width={40}
                                            height={40}
                                        />
                                    ) : (
                                        <span>{c.displayName.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>

                                <div className="rail-creator__meta">
                                    <span className="rail-creator__name">
                                        {c.displayName}
                                        {c.isVerified && (
                                            <BadgeCheck size={13} className="rail-creator__verified" />
                                        )}
                                    </span>
                                    <span className="rail-creator__sub">
                                        {formatCount(c.followersCount)} followers
                                    </span>
                                </div>
                            </Link>

                            <button
                                type="button"
                                className={`rail-creator__follow ${c.isFollowing ? "rail-creator__follow--following" : ""}`}
                                onClick={() => handleToggleFollow(c.id, c.isFollowing)}
                                disabled={togglingIds.has(c.id)}
                            >
                                {c.isFollowing ? "Following" : "Follow"}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    )
}