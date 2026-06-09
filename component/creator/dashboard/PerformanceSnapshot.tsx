// components/creator/dashboard/PerformanceSnapshot.tsx
import { TrendingUp, Calendar } from "lucide-react"
import type { DashboardData } from "@/actions/creator/dashboard"
import { format } from "date-fns"
import "@/styles/creator/dashboard/PerformanceSnapshot.scss"

type Props = {
    stats: DashboardData["stats"]
    upcomingStreams: DashboardData["upcomingStreams"]
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(n)

export const PerformanceSnapshot = ({ stats, upcomingStreams }: Props) => {

    const metrics = [
        {
            label: "New Followers",
            value: `+${stats.newFollowersThisWeek}`,
            sub: "this week",
            color: "primary",
        },
        {
            label: "New Subscribers",
            value: `+${stats.newSubscribersThisMonth}`,
            sub: "this month",
            color: "green",
        },
        {
            label: "Monthly Revenue",
            value: fmtMoney(stats.monthlyEarnings),
            sub: "this month",
            color: "blue",
        },
        {
            label: "Available Balance",
            value: fmtMoney(stats.walletBalance),
            sub: "in wallet",
            color: "amber",
        },
    ]

    return (
        <div className="perf-snapshot">
            <h2 className="dashboard-section-title">Performance Snapshot</h2>

            <div className="perf-snapshot__metrics">
                {metrics.map((m) => (
                    <div key={m.label} className={`perf-metric perf-metric--${m.color}`}>
                        <p className="perf-metric__value">{m.value}</p>
                        <p className="perf-metric__label">
                            {m.label} <span>{m.sub}</span>
                        </p>
                    </div>
                ))}
            </div>

            {/* Upcoming streams */}
            <div className="perf-panel">
                <div className="perf-panel__head">
                    <Calendar size={15} />
                    Upcoming Scheduled Streams
                </div>

                <div className="perf-panel__list">
                    {upcomingStreams.length === 0 ? (
                        <div className="perf-panel__empty">
                            No upcoming streams scheduled
                        </div>
                    ) : (
                        upcomingStreams.map((stream) => (
                            <div key={stream.id} className="perf-panel__row">
                                <div className="perf-panel__dot" />
                                <div className="perf-panel__info">
                                    <p>{stream.title}</p>
                                    <span>
                                        {stream.startedAt
                                            ? format(new Date(stream.startedAt), "EEE d MMM · h:mm a")
                                            : "TBD"
                                        }
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}