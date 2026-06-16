// components/creator/audience/top-fans/TopFansPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Crown, Loader2, Info }    from "lucide-react"
import { getTopFansAction }        from "@/actions/creator/audience"
import { TopFanCard }              from "./TopFanCard"
import "@/styles/creator/audience/TopFansPage.scss"

type TopFan = Awaited<ReturnType<typeof getTopFansAction>>["topFans"][0]

export const TopFansPage = () => {

    const [fans,      setFans]      = useState<TopFan[]>([])
    const [total,     setTotal]     = useState(0)
    const [pages,     setPages]     = useState(1)
    const [page,      setPage]      = useState(1)
    const [isPending, startTransition] = useTransition()
    const [showInfo,  setShowInfo]  = useState(false)

    const fetchTopFans = useCallback(() => {
        startTransition(async () => {
            const res = await getTopFansAction({ page, limit: 20 })
            setFans(res.topFans as TopFan[])
            setTotal(res.total)
            setPages(res.pages)
        })
    }, [page])

    useEffect(() => { fetchTopFans() }, [fetchTopFans])

    return (
        <div className="top-fans-page">

            {/* ── Header ── */}
            <div className="top-fans-page__header">
                <div className="top-fans-page__title">
                    <Crown size={20} />
                    <div>
                        <h2>Top Fans</h2>
                        <p>
                            {total === 0
                                ? "No fan activity yet"
                                : `${total.toLocaleString()} ranked supporter${total !== 1 ? "s" : ""}`
                            }
                        </p>
                    </div>
                </div>

                {/* Score info */}
                <div className="top-fans-page__info-wrap">
                    <button
                        className="top-fans-info-btn"
                        onClick={() => setShowInfo((v) => !v)}
                    >
                        <Info size={15} />
                        How scores work
                    </button>

                    {showInfo && (
                        <div className="top-fans-info-panel">
                            <h4>Fan Score Breakdown</h4>
                            <ul>
                                <li>
                                    <span className="info-dot info-dot--gift" />
                                    <div>
                                        <strong>Gift spending</strong>
                                        <p>2 points per ₦1 spent on gifts</p>
                                    </div>
                                </li>
                                <li>
                                    <span className="info-dot info-dot--sub" />
                                    <div>
                                        <strong>Subscription value</strong>
                                        <p>1 point per ₦1 paid + 1 point per day subscribed</p>
                                    </div>
                                </li>
                                <li>
                                    <span className="info-dot info-dot--follow" />
                                    <div>
                                        <strong>Loyalty</strong>
                                        <p>0.5 points per day following you</p>
                                    </div>
                                </li>
                            </ul>
                            <p className="info-note">
                                Scores update in real time as fans interact with your content.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Podium (top 3) ── */}
            {fans.length >= 3 && (
                <div className="top-fans-podium">
                    {/* 2nd place */}
                    <div className="podium-slot podium-slot--2">
                        <div className="podium-avatar">
                            {fans[1].user?.image ? (
                                <img src={fans[1].user.image} alt="" />
                            ) : (
                                <span>
                                    {(fans[1].user?.firstName ?? "?").charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <p className="podium-name">
                            {fans[1].user?.username
                                ? `@${fans[1].user.username}`
                                : fans[1].user?.firstName ?? "Fan"
                            }
                        </p>
                        <div className="podium-bar podium-bar--2">
                            <span>🥈 2nd</span>
                        </div>
                    </div>

                    {/* 1st place */}
                    <div className="podium-slot podium-slot--1">
                        <div className="podium-crown">👑</div>
                        <div className="podium-avatar podium-avatar--1">
                            {fans[0].user?.image ? (
                                <img src={fans[0].user.image} alt="" />
                            ) : (
                                <span>
                                    {(fans[0].user?.firstName ?? "?").charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <p className="podium-name">
                            {fans[0].user?.username
                                ? `@${fans[0].user.username}`
                                : fans[0].user?.firstName ?? "Fan"
                            }
                        </p>
                        <div className="podium-bar podium-bar--1">
                            <span>👑 1st</span>
                        </div>
                    </div>

                    {/* 3rd place */}
                    <div className="podium-slot podium-slot--3">
                        <div className="podium-avatar">
                            {fans[2].user?.image ? (
                                <img src={fans[2].user.image} alt="" />
                            ) : (
                                <span>
                                    {(fans[2].user?.firstName ?? "?").charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>
                        <p className="podium-name">
                            {fans[2].user?.username
                                ? `@${fans[2].user.username}`
                                : fans[2].user?.firstName ?? "Fan"
                            }
                        </p>
                        <div className="podium-bar podium-bar--3">
                            <span>🥉 3rd</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Full list ── */}
            {isPending ? (
                <div className="top-fans-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : fans.length === 0 ? (
                <div className="top-fans-page__empty">
                    <Crown size={32} />
                    <h3>No fan activity yet</h3>
                    <p>
                        As fans follow, subscribe, and send gifts,
                        they'll appear here ranked by engagement.
                    </p>
                </div>
            ) : (
                <>
                    <div className="top-fans-page__list">
                        {fans.map((fan, i) => (
                            <TopFanCard
                                key={fan.userId}
                                fan={fan as any}
                                rank={(page - 1) * 20 + i + 1}
                            />
                        ))}
                    </div>

                    {pages > 1 && (
                        <div className="top-fans-page__pagination">
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