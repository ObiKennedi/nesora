// components/creator/audience/subscribers/SubscriberCard.tsx
"use client"

import Image from "next/image"
import { Star, Clock, CheckCircle, XCircle } from "lucide-react"
import { format, formatDistanceToNow, isPast } from "date-fns"
import "@/styles/creator/audience/SubscriberCard.scss"

type Props = {
    subscription: {
        id: string
        status: string
        amountPaid: any
        startedAt: Date
        expiresAt: Date
        createdAt: Date
        user: {
            id: string
            username: string | null
            firstName: string | null
            lastName: string | null
            image: string | null
        }
    }
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(n)

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    ACTIVE: { label: "Active", color: "green", icon: <CheckCircle size={11} /> },
    EXPIRED: { label: "Expired", color: "red", icon: <XCircle size={11} /> },
    CANCELLED: { label: "Cancelled", color: "amber", icon: <XCircle size={11} /> },
}

export const SubscriberCard = ({ subscription: sub }: Props) => {

    const name = [sub.user.firstName, sub.user.lastName].filter(Boolean).join(" ") || "Anonymous"
    const handle = sub.user.username ? `@${sub.user.username}` : null
    const config = statusConfig[sub.status] ?? statusConfig.EXPIRED
    const expiry = new Date(sub.expiresAt)
    const isExpiringSoon = !isPast(expiry) &&
        expiry.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 // within 7 days

    return (
        <div className={`subscriber-card subscriber-card--${config.color}`}>

            {/* ── Avatar ── */}
            <div className="subscriber-card__avatar">
                {sub.user.image ? (
                    <img src={sub.user.image} alt={name} width={44} height={44} />
                ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                )}
            </div>

            {/* ── Info ── */}
            <div className="subscriber-card__info">
                <div className="subscriber-card__top">
                    <p className="subscriber-card__name">{name}</p>
                    <span className={`sub-badge sub-badge--${config.color}`}>
                        {config.icon}
                        {config.label}
                    </span>
                </div>
                {handle && (
                    <p className="subscriber-card__handle">{handle}</p>
                )}
                <div className="subscriber-card__meta">
                    <span>
                        <Star size={11} />
                        Subscribed {formatDistanceToNow(new Date(sub.startedAt), { addSuffix: true })}
                    </span>
                    <span className={isExpiringSoon ? "expiring-soon" : ""}>
                        <Clock size={11} />
                        {isPast(expiry)
                            ? `Expired ${formatDistanceToNow(expiry, { addSuffix: true })}`
                            : `Expires ${format(expiry, "d MMM yyyy")}`
                        }
                        {isExpiringSoon && " ⚠️"}
                    </span>
                </div>
            </div>

            {/* ── Amount ── */}
            <div className="subscriber-card__amount">
                <p className="subscriber-card__amount-value">
                    {fmtMoney(Number(sub.amountPaid))}
                </p>
                <p className="subscriber-card__amount-label">paid</p>
            </div>

        </div>
    )
}