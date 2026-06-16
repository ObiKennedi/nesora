// components/creator/audience/top-fans/TopFanCard.tsx
"use client"

import Image                       from "next/image"
import { Crown, Star, Gift, Clock } from "lucide-react"
import { formatDistanceToNow }     from "date-fns"
import "@/styles/creator/audience/TopFanCard.scss"

type Fan = {
    userId:          string
    giftTotal:       number
    giftCount:       number
    followedAt:      Date | null
    isSubscriber:    boolean
    subscriptionAge: number
    score:           number
    user: {
        id:        string
        username:  string | null
        firstName: string | null
        lastName:  string | null
        image:     string | null
    } | null
}

type Props = {
    fan:   Fan
    rank:  number
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style:                 "currency",
        currency:              "NGN",
        maximumFractionDigits: 0,
    }).format(n)

const getRankStyle = (rank: number) => {
    if (rank === 1) return { label: "👑", color: "gold",   cls: "rank--gold"   }
    if (rank === 2) return { label: "🥈", color: "silver", cls: "rank--silver" }
    if (rank === 3) return { label: "🥉", color: "bronze", cls: "rank--bronze" }
    return               { label: `#${rank}`, color: "default", cls: "rank--default" }
}

export const TopFanCard = ({ fan, rank }: Props) => {

    if (!fan.user) return null

    const name   = [fan.user.firstName, fan.user.lastName].filter(Boolean).join(" ") || "Anonymous"
    const handle = fan.user.username ? `@${fan.user.username}` : null
    const rank_  = getRankStyle(rank)

    return (
        <div className={`top-fan-card ${rank <= 3 ? `top-fan-card--${rank_.color}` : ""}`}>

            {/* ── Rank ── */}
            <div className={`top-fan-rank ${rank_.cls}`}>
                <span>{rank_.label}</span>
            </div>

            {/* ── Avatar ── */}
            <div className="top-fan-avatar">
                {fan.user.image ? (
                    <Image src={fan.user.image} alt={name} width={48} height={48} />
                ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                )}
                {fan.isSubscriber && (
                    <span className="top-fan-avatar__sub" title="Subscriber">
                        <Star size={10} />
                    </span>
                )}
            </div>

            {/* ── Info ── */}
            <div className="top-fan-info">
                <p className="top-fan-info__name">{name}</p>
                {handle && <p className="top-fan-info__handle">{handle}</p>}

                <div className="top-fan-signals">
                    {fan.giftTotal > 0 && (
                        <span className="top-fan-signal top-fan-signal--gift">
                            <Gift size={11} />
                            {fmtMoney(fan.giftTotal)} gifted
                        </span>
                    )}
                    {fan.isSubscriber && (
                        <span className="top-fan-signal top-fan-signal--sub">
                            <Star size={11} />
                            {fan.subscriptionAge}d subscriber
                        </span>
                    )}
                    {fan.followedAt && (
                        <span className="top-fan-signal top-fan-signal--follow">
                            <Clock size={11} />
                            Followed {formatDistanceToNow(new Date(fan.followedAt), { addSuffix: true })}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Score ── */}
            <div className="top-fan-score">
                <p className="top-fan-score__value">
                    {Math.round(fan.score).toLocaleString()}
                </p>
                <p className="top-fan-score__label">fan score</p>
            </div>

        </div>
    )
}