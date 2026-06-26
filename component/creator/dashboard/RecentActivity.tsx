// components/creator/dashboard/RecentActivity.tsx
import {
    UserPlus, Star, Gift,
} from "lucide-react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import type { DashboardData } from "@/actions/creator/dashboard"
import "@/styles/creator/dashboard/RecentActivity.scss"

type Props = {
    recentFollows: DashboardData["recentFollows"]
    recentSubscriptions: DashboardData["recentSubscriptions"]
    recentGifts: DashboardData["recentGifts"]
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(n)

export const RecentActivity = ({
    recentFollows,
    recentSubscriptions,
    recentGifts,
}: Props) => {

    // Merge + sort all activity by date
    const activity = [
        ...recentFollows.map((f) => ({
            id: f.id,
            type: "follow" as const,
            user: f.user,
            action: "started following you",
            amount: null,
            gift: null,
            time: f.createdAt,
        })),
        ...recentSubscriptions.map((s) => ({
            id: s.id,
            type: "subscribe" as const,
            user: s.user,
            action: "subscribed to your plan",
            amount: Number(s.amountPaid),
            gift: null,
            time: s.createdAt,
        })),
        ...recentGifts.map((g) => ({
            id: g.id,
            type: "gift" as const,
            user: g.sender,
            action: `sent ${g.quantity}x ${g.gift.name}`,
            amount: Number(g.amount),
            gift: g.gift.name,
            time: g.createdAt,
        })),
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 10)

    const iconMap = {
        follow: { icon: <UserPlus size={14} />, color: "primary" },
        subscribe: { icon: <Star size={14} />, color: "green" },
        gift: { icon: <Gift size={14} />, color: "amber" },
    }

    return (
        <div className="recent-activity">
            <h2 className="dashboard-section-title">Recent Activity</h2>

            <div className="recent-activity__list">
                {activity.length === 0 ? (
                    <div className="recent-activity__empty">
                        <p>No activity yet. Share your profile to get started!</p>
                    </div>
                ) : (
                    activity.map((item) => {
                        const { icon, color } = iconMap[item.type]
                        const name = item.user.username
                            ? `@${item.user.username}`
                            : item.user.firstName

                        return (
                            <div key={`${item.type}-${item.id}`} className="activity-item">
                                {/* User avatar */}
                                <div className="activity-item__avatar">
                                    {item.user.image ? (
                                        <img
                                            src={item.user.image}
                                            alt={name ?? ""}
                                            width={28}
                                            height={28}
                                        />
                                    ) : (
                                        <span>
                                            {(item.user.firstName ?? "?").charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                <div className="activity-item__body">
                                    <p>
                                        <strong>{name}</strong> {item.action}
                                        {item.amount != null && (
                                            <span className="activity-item__amount">
                                                {" · "}{fmtMoney(item.amount)}
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <div className="activity-item__right">
                                    <div className={`activity-item__icon activity-item__icon--${color}`}>
                                        {icon}
                                    </div>
                                    <span className="activity-item__time">
                                        {formatDistanceToNow(new Date(item.time), { addSuffix: true })}
                                    </span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}