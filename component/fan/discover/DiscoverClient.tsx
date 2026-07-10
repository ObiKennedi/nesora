"use client"

import { useState, useTransition, useCallback } from "react"
import Image                                     from "next/image"
import Link                                      from "next/link"
import {
    Search, Loader2, UserPlus, UserCheck,
    BadgeCheck, Users, Compass,
} from "lucide-react"
import { Category }                              from "@prisma/client"
import {
    getDiscoverCreatorsAction,
    followCreatorAction,
    unfollowCreatorAction,
} from "@/actions/fan/discover"
import "@/styles/fan/discover/DiscoverClient.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type DiscoverCreator = {
    id:             string
    displayName:    string
    handle:         string | null
    bio:            string | null
    image:          string | null
    bannerImage:    string | null
    isVerified:     boolean
    followersCount: number
    categories:     Category[]
    isFollowing:    boolean
    isSubscribed:   boolean
    relevanceScore: number
}

type Props = {
    initialCreators: DiscoverCreator[]
    initialTotal:    number
    initialPages:    number
    rankedCategories: Category[]
    categoryLabels:  Record<string, { label: string; emoji: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DiscoverClient({
    initialCreators,
    initialTotal,
    initialPages,
    rankedCategories,
    categoryLabels,
}: Props) {
    const [creators,       setCreators]       = useState<DiscoverCreator[]>(initialCreators)
    const [total,          setTotal]          = useState(initialTotal)
    const [pages,          setPages]          = useState(initialPages)
    const [page,           setPage]           = useState(1)
    const [search,         setSearch]         = useState("")
    const [activeCategory, setActiveCategory] = useState<Category | "ALL">("ALL")
    const [loading,        setLoading]        = useState(false)
    const [loadingMore,    setLoadingMore]    = useState(false)

    const [isPending, startTransition] = useTransition()

    // Track which creators are being followed/unfollowed
    const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())

    // ── Fetch creators ────────────────────────────────────────────────────────
    const fetchCreators = useCallback(async (opts: {
        category?: Category | "ALL"
        search?:   string
        page?:     number
        append?:   boolean
    }) => {
        const { category, search: q, page: p = 1, append = false } = opts

        if (append) setLoadingMore(true)
        else setLoading(true)

        try {
            const data = await getDiscoverCreatorsAction({
                category: category ?? "ALL",
                search:   q,
                page:     p,
            })

            if (append) {
                setCreators((prev) => {
                    const ids = new Set(prev.map((c) => c.id))
                    return [...prev, ...data.creators.filter((c) => !ids.has(c.id))]
                })
            } else {
                setCreators(data.creators)
            }

            setTotal(data.total)
            setPages(data.pages)
            setPage(p)
        } finally {
            setLoading(false)
            setLoadingMore(false)
        }
    }, [])

    // ── Category change ───────────────────────────────────────────────────────
    const handleCategoryChange = (cat: Category | "ALL") => {
        setActiveCategory(cat)
        fetchCreators({ category: cat, search })
    }

    // ── Search ────────────────────────────────────────────────────────────────
    const handleSearch = (value: string) => {
        setSearch(value)
        // Debounce would be nice here, but keep it simple
        if (value.length === 0 || value.length >= 2) {
            fetchCreators({ category: activeCategory, search: value })
        }
    }

    // ── Load more ─────────────────────────────────────────────────────────────
    const handleLoadMore = () => {
        fetchCreators({
            category: activeCategory,
            search,
            page: page + 1,
            append: true,
        })
    }

    // ── Follow / unfollow ─────────────────────────────────────────────────────
    const handleToggleFollow = (creatorId: string, isCurrentlyFollowing: boolean) => {
        // Optimistic update
        setCreators((prev) =>
            prev.map((c) =>
                c.id === creatorId
                    ? {
                        ...c,
                        isFollowing:    !isCurrentlyFollowing,
                        followersCount: isCurrentlyFollowing
                            ? c.followersCount - 1
                            : c.followersCount + 1,
                    }
                    : c
            )
        )

        setTogglingIds((prev) => new Set(prev).add(creatorId))

        startTransition(async () => {
            const action = isCurrentlyFollowing ? unfollowCreatorAction : followCreatorAction
            const res = await action(creatorId)

            if (!res.success) {
                // Revert on failure
                setCreators((prev) =>
                    prev.map((c) =>
                        c.id === creatorId
                            ? {
                                ...c,
                                isFollowing:    isCurrentlyFollowing,
                                followersCount: isCurrentlyFollowing
                                    ? c.followersCount + 1
                                    : c.followersCount - 1,
                            }
                            : c
                    )
                )
            }

            setTogglingIds((prev) => {
                const next = new Set(prev)
                next.delete(creatorId)
                return next
            })
        })
    }

    // ── Category chips ────────────────────────────────────────────────────────
    const chips: { value: Category | "ALL"; label: string; emoji: string }[] = [
        { value: "ALL", label: "For You", emoji: "✨" },
        ...rankedCategories.map((cat) => ({
            value: cat,
            label: categoryLabels[cat]?.label ?? cat,
            emoji: categoryLabels[cat]?.emoji ?? "📌",
        })),
    ]

    return (
        <div className="discover">

            {/* ── Header ── */}
            <div className="discover__header">
                <div className="discover__title">
                    <Compass size={22} />
                    <h1>Discover</h1>
                </div>

                <div className="discover__search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search creators..."
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Category chips ── */}
            <div className="discover__chips">
                {chips.map((chip) => (
                    <button
                        key={chip.value}
                        type="button"
                        className={`discover__chip ${activeCategory === chip.value ? "discover__chip--active" : ""}`}
                        onClick={() => handleCategoryChange(chip.value)}
                    >
                        <span>{chip.emoji}</span>
                        <span>{chip.label}</span>
                    </button>
                ))}
            </div>

            {/* ── Creator grid ── */}
            {loading ? (
                <div className="discover__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : creators.length === 0 ? (
                <div className="discover__empty">
                    <Compass size={40} />
                    <h3>No creators found</h3>
                    <p>
                        {search
                            ? `No results for "${search}"`
                            : "Try exploring different categories"
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="discover__grid">
                        {creators.map((creator) => {
                            const isToggling = togglingIds.has(creator.id)

                            return (
                                <div key={creator.id} className="creator-card">
                                    {/* Banner / color strip */}
                                    <div className="creator-card__banner">
                                        {creator.bannerImage ? (
                                            <img
                                                src={creator.bannerImage}
                                                alt=""
                                                className="creator-card__banner-img"
                                            />
                                        ) : (
                                            <div className="creator-card__banner-fallback" />
                                        )}
                                    </div>

                                    {/* Avatar */}
                                    <div className="creator-card__avatar-wrap">
                                        <div className="creator-card__avatar">
                                            {creator.image ? (
                                                <Image
                                                    src={creator.image}
                                                    alt={creator.displayName}
                                                    width={56}
                                                    height={56}
                                                />
                                            ) : (
                                                <span>{creator.displayName.charAt(0).toUpperCase()}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="creator-card__info">
                                        <Link
                                            href={`/fan/${creator.handle ?? creator.id}`}
                                            className="creator-card__name-link"
                                        >
                                            <span className="creator-card__name">
                                                {creator.displayName}
                                            </span>
                                            {creator.isVerified && (
                                                <BadgeCheck size={14} className="creator-card__verified" />
                                            )}
                                        </Link>

                                        {creator.handle && (
                                            <span className="creator-card__handle">
                                                @{creator.handle}
                                            </span>
                                        )}

                                        {creator.bio && (
                                            <p className="creator-card__bio">{creator.bio}</p>
                                        )}

                                        {/* Category tags */}
                                        <div className="creator-card__tags">
                                            {creator.categories.slice(0, 3).map((cat) => (
                                                <span key={cat} className="creator-card__tag">
                                                    {categoryLabels[cat]?.emoji ?? "📌"}{" "}
                                                    {categoryLabels[cat]?.label ?? cat}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Stats + follow */}
                                        <div className="creator-card__footer">
                                            <span className="creator-card__followers">
                                                <Users size={13} />
                                                {formatCount(creator.followersCount)}
                                            </span>

                                            {creator.isFollowing ? (
                                                <button
                                                    className="creator-card__btn creator-card__btn--following"
                                                    onClick={() => handleToggleFollow(creator.id, true)}
                                                    disabled={isToggling}
                                                >
                                                    <UserCheck size={14} />
                                                    Following
                                                </button>
                                            ) : (
                                                <button
                                                    className="creator-card__btn creator-card__btn--follow"
                                                    onClick={() => handleToggleFollow(creator.id, false)}
                                                    disabled={isToggling}
                                                >
                                                    <UserPlus size={14} />
                                                    Follow
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Load more */}
                    {page < pages && (
                        <div className="discover__load-more">
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? (
                                    <><Loader2 size={16} className="spin" /> Loading...</>
                                ) : (
                                    "Show more creators"
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
