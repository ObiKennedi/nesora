// components/creator/dashboard/OverviewCards.tsx
import {
    Users, UserCheck, DollarSign,
    Clock, BadgeCheck, CircleAlert,
    TrendingUp,
} from "lucide-react"
import type { DashboardData } from "@/actions/creator/dashboard"
import "@/styles/creator/dashboard/OverviewCards.scss"

type Props = { stats: DashboardData["stats"]; verificationStatus: string }

const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
        : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
            : n.toString()

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(n)

export const OverviewCards = ({ stats, verificationStatus }: Props) => {

    const verifLabel: Record<string, string> = {
        APPROVED: "Verified ✓",
        PENDING: "Under Review",
        REJECTED: "Rejected",
    }
    const verifColor: Record<string, string> = {
        APPROVED: "green",
        PENDING: "amber",
        REJECTED: "red",
    }

    const cards = [
        {
            id: "followers",
            label: "Total Followers",
            value: fmt(stats.followersCount),
            icon: <Users size={20} />,
            color: "primary",
            sub: `+${fmt(stats.newFollowersThisWeek)} this week`,
            trend: stats.newFollowersThisMonth,
        },
        {
            id: "subscribers",
            label: "Total Subscribers",
            value: fmt(stats.subscribersCount),
            icon: <UserCheck size={20} />,
            color: "green",
            sub: `+${stats.newSubscribersThisMonth} this month`,
            trend: stats.newSubscribersThisMonth,
        },
        {
            id: "earnings",
            label: "Monthly Earnings",
            value: fmtMoney(stats.monthlyEarnings),
            icon: <DollarSign size={20} />,
            color: "blue",
            sub: "Subscriptions + gifts",
            trend: null,
        },
        {
            id: "payouts",
            label: "Pending Payouts",
            value: fmtMoney(stats.pendingPayouts),
            icon: <Clock size={20} />,
            color: "amber",
            sub: stats.pendingPayouts > 0 ? "Processing in 2–3 days" : "No pending payouts",
            trend: null,
        },
        {
            id: "profile",
            label: "Profile Completion",
            value: `${stats.profileCompletion}%`,
            icon: <BadgeCheck size={20} />,
            color: "purple",
            sub: stats.profileCompletion < 100 ? "Complete your profile" : "Profile complete 🎉",
            trend: null,
            progress: stats.profileCompletion,
        },
        {
            id: "verification",
            label: "Verification Status",
            value: verifLabel[verificationStatus] ?? "Not Started",
            icon: <CircleAlert size={20} />,
            color: verifColor[verificationStatus] ?? "red",
            sub: verificationStatus === "PENDING"
                ? "Under review · 24–48hrs"
                : verificationStatus === "APPROVED"
                    ? "Your identity is verified"
                    : "Submit your documents",
            trend: null,
        },
    ]

    return (
        <div className="overview-cards">
            {cards.map((card) => (
                <div
                    key={card.id}
                    className={`overview-card overview-card--${card.color}`}
                >
                    <div className="overview-card__top">
                        <span className="overview-card__icon">{card.icon}</span>
                        {card.trend != null && card.trend > 0 && (
                            <span className="overview-card__trend overview-card__trend--up">
                                <TrendingUp size={12} />
                                +{card.trend}
                            </span>
                        )}
                    </div>

                    <div className="overview-card__body">
                        <p className="overview-card__value">{card.value}</p>
                        <p className="overview-card__label">{card.label}</p>
                        {card.progress != null && (
                            <div className="overview-card__progress">
                                <div
                                    className="overview-card__progress-fill"
                                    style={{ width: `${card.progress}%` }}
                                />
                            </div>
                        )}
                        <p className="overview-card__sub">{card.sub}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}