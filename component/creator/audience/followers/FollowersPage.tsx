// components/creator/audience/followers/FollowersPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Users, Search, Loader2, UserX } from "lucide-react"
import { getFollowersAction } from "@/actions/creator/audience"
import { FollowerCard } from "./FollowerCard"
import "@/styles/creator/audience/FollowersPage.scss"

type Follower = Awaited<ReturnType<typeof getFollowersAction>>["followers"][0]

export const FollowersPage = () => {

    const [followers, setFollowers] = useState<Follower[]>([])
    const [total, setTotal] = useState(0)
    const [pages, setPages] = useState(1)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [query, setQuery] = useState("")
    const [isPending, startTransition] = useTransition()

    const fetchFollowers = useCallback(() => {
        startTransition(async () => {
            const res = await getFollowersAction({
                search: query || undefined,
                page,
                limit: 20,
            })
            setFollowers(res.followers)
            setTotal(res.total)
            setPages(res.pages)
        })
    }, [query, page])

    useEffect(() => { fetchFollowers() }, [fetchFollowers])

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => {
            setQuery(search)
            setPage(1)
        }, 400)
        return () => clearTimeout(t)
    }, [search])

    return (
        <div className="followers-page">

            {/* ── Header ── */}
            <div className="followers-page__header">
                <div className="followers-page__title">
                    <Users size={20} />
                    <div>
                        <h2>Followers</h2>
                        <p>
                            {total === 0
                                ? "No followers yet"
                                : `${total.toLocaleString()} follower${total !== 1 ? "s" : ""}`
                            }
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="followers-page__search">
                    <Search size={15} />
                    <input
                        type="text"
                        placeholder="Search followers…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Content ── */}
            {isPending ? (
                <div className="followers-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : followers.length === 0 ? (
                <div className="followers-page__empty">
                    <UserX size={32} />
                    <h3>
                        {query
                            ? `No followers matching "${query}"`
                            : "No followers yet"
                        }
                    </h3>
                    <p>
                        {query
                            ? "Try a different search term."
                            : "Share your profile to start growing your audience."
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="followers-page__grid">
                        {followers.map((follower) => (
                            <FollowerCard
                                key={follower.id}
                                follower={follower}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    {pages > 1 && (
                        <div className="followers-page__pagination">
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page === 1 || isPending}
                            >
                                Previous
                            </button>
                            <span className="page-indicator">
                                Page {page} of {pages}
                            </span>
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page === pages || isPending}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

        </div>
    )
}