"use client"

import { useState, useTransition }              from "react"
import { useRouter }                             from "next/navigation"
import { CheckCircle, Users, Loader2, UserPlus } from "lucide-react"
import { Category }                              from "@prisma/client"
import {
    followCreatorOnboardingAction,
    unfollowCreatorOnboardingAction,
    bulkFollowCreatorsAction,
} from "@/actions/fan/creators"
import { CATEGORIES } from "@/lib/categories"
import "@/styles/onboarding/WhoToFollow.scss"

type Creator = {
    id:               string
    displayName:      string
    handle:           string | null
    bio:              string | null
    image:            string | null
    isVerified:       boolean
    followersCount:   number
    subscribersCount: number
    categories:       Category[]
    isFollowing:      boolean
}

type Props = {
    initialCreators: Creator[]
    categories:      Category[]
}

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

export function WhoToFollowClient({ initialCreators, categories }: Props) {
    const router = useRouter()

    const [creators,    setCreators]    = useState<Creator[]>(initialCreators)
    const [activeFilter, setActiveFilter] = useState<Category | "ALL">("ALL")
    const [isPending,   startTransition] = useTransition()
    const [isFinishing, setIsFinishing]  = useState(false)

    const followingCount = creators.filter((c) => c.isFollowing).length

    // ── Toggle follow on a single creator ─────────────────────────────────────
    const toggleFollow = (creatorId: string) => {
        const creator  = creators.find((c) => c.id === creatorId)
        if (!creator) return

        // Optimistic update
        setCreators((prev) =>
            prev.map((c) =>
                c.id === creatorId ? { ...c, isFollowing: !c.isFollowing } : c
            )
        )

        startTransition(async () => {
            const action = creator.isFollowing
                ? unfollowCreatorOnboardingAction
                : followCreatorOnboardingAction

            const res = await action(creatorId)

            // Rollback on error
            if (!res.success) {
                setCreators((prev) =>
                    prev.map((c) =>
                        c.id === creatorId ? { ...c, isFollowing: creator.isFollowing } : c
                    )
                )
            }
        })
    }

    // ── Follow all visible creators ───────────────────────────────────────────
    const followAll = () => {
        const toFollow = filtered
            .filter((c) => !c.isFollowing)
            .map((c) => c.id)

        if (toFollow.length === 0) return

        // Optimistic
        setCreators((prev) =>
            prev.map((c) =>
                toFollow.includes(c.id) ? { ...c, isFollowing: true } : c
            )
        )

        startTransition(async () => {
            await bulkFollowCreatorsAction(toFollow)
        })
    }

    // ── Finish and show billing plans ─────────────────────────────────────────
    const finish = async () => {
        setIsFinishing(true)
        router.push("/onboarding/fan/billing")
    }


    // ── Filter by category chip ───────────────────────────────────────────────
    const filtered = activeFilter === "ALL"
        ? creators
        : creators.filter((c) => c.categories.includes(activeFilter))

    // Build chip list from fan's categories only
    const chips = [
        { value: "ALL" as const, label: "All", emoji: "✨" },
        ...CATEGORIES.filter((cat) => categories.includes(cat.value)),
    ]

    return (
        <div className="who-to-follow">

            {/* Header */}
            <div className="who-to-follow__header">
                <span className="who-to-follow__eyebrow">Fan Onboarding</span>
                <h1>Follow your favourite creators</h1>
                <p>
                    We found the top creators in your categories. Follow a few to
                    fill your feed with content you'll love.
                </p>
            </div>

            {/* Category chips */}
            <div className="who-to-follow__chips">
                {chips.map((chip) => (
                    <button
                        key={chip.value}
                        type="button"
                        className={`follow-chip ${activeFilter === chip.value ? "follow-chip--active" : ""}`}
                        onClick={() => setActiveFilter(chip.value)}
                    >
                        <span>{chip.emoji}</span>
                        <span>{chip.label}</span>
                    </button>
                ))}
            </div>

            {/* Follow all bar */}
            {filtered.some((c) => !c.isFollowing) && (
                <div className="who-to-follow__bulk">
                    <span className="who-to-follow__bulk-label">
                        {followingCount > 0
                            ? `Following ${followingCount} creator${followingCount !== 1 ? "s" : ""}`
                            : "Follow all to get started fast"
                        }
                    </span>
                    <button
                        type="button"
                        className="follow-all-btn"
                        onClick={followAll}
                        disabled={isPending}
                    >
                        <UserPlus size={14} />
                        Follow All
                    </button>
                </div>
            )}

            {/* Creator grid */}
            <div className="who-to-follow__grid">
                {filtered.length === 0 && (
                    <p className="who-to-follow__empty">
                        No creators found in this category yet.
                    </p>
                )}

                {filtered.map((creator) => (
                    <div
                        key={creator.id}
                        className={`creator-follow-card ${creator.isFollowing ? "creator-follow-card--following" : ""}`}
                    >
                        {/* Avatar */}
                        <div className="creator-follow-card__avatar">
                            {creator.image ? (
                                <img
                                    src={creator.image}
                                    alt={creator.displayName}
                                />
                            ) : (
                                <span className="creator-follow-card__avatar-fallback">
                                    {creator.displayName.charAt(0).toUpperCase()}
                                </span>
                            )}
                            {creator.isVerified && (
                                <span className="creator-follow-card__verified" title="Verified">
                                    ✓
                                </span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="creator-follow-card__info">
                            <span className="creator-follow-card__name">
                                {creator.displayName}
                            </span>
                            {creator.handle && (
                                <span className="creator-follow-card__handle">
                                    @{creator.handle}
                                </span>
                            )}
                            <div className="creator-follow-card__stats">
                                <span>
                                    <Users size={11} />
                                    {formatCount(creator.followersCount)} followers
                                </span>
                            </div>
                            {/* Category badges */}
                            <div className="creator-follow-card__cats">
                                {creator.categories.slice(0, 2).map((cat) => {
                                    const meta = CATEGORIES.find((c) => c.value === cat)
                                    return meta ? (
                                        <span key={cat} className="creator-follow-card__cat-badge">
                                            {meta.emoji} {meta.label}
                                        </span>
                                    ) : null
                                })}
                            </div>
                        </div>

                        {/* Follow button */}
                        <button
                            type="button"
                            className={`follow-btn ${creator.isFollowing ? "follow-btn--following" : ""}`}
                            onClick={() => toggleFollow(creator.id)}
                            disabled={isPending}
                        >
                            {creator.isFollowing ? (
                                <><CheckCircle size={13} /> Following</>
                            ) : (
                                <>+ Follow</>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* Footer actions */}
            <div className="who-to-follow__footer">
                <button
                    className="onboarding-submit"
                    onClick={finish}
                    disabled={isFinishing}
                >
                    {isFinishing
                        ? <><Loader2 size={16} className="spin" /> Taking you to your feed…</>
                        : followingCount > 0
                            ? `Continue to Feed →`
                            : "Continue to Feed →"
                    }
                </button>

                {followingCount === 0 && (
                    <p className="who-to-follow__skip">
                        <button
                            type="button"
                            className="skip-link"
                            onClick={finish}
                            disabled={isFinishing}
                        >
                            Skip for now
                        </button>
                        {" "}— you can discover creators from the explore page
                    </p>
                )}
            </div>

        </div>
    )
}