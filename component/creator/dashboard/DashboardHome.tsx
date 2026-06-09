// components/creator/dashboard/DashboardHome.tsx
import { OverviewCards } from "@/component/creator/dashboard/OverviewCards"
import { QuickActions } from "@/component/creator/dashboard/QuickActions"
import { PerformanceSnapshot } from "@/component/creator/dashboard/PerformanceSnapshot"
import { RecentActivity } from "@/component/creator/dashboard/RecentActivity"
import type { DashboardData } from "@/actions/creator/dashboard"
import "@/styles/creator/dashboard/DashboardHome.scss"

type Props = { data: DashboardData }

export const DashboardHome = ({ data }: Props) => {
    return (
        <div className="dashboard-home">
            <OverviewCards
                stats={data.stats}
                verificationStatus={data.creator.verificationStatus}
            />

            <div className="dashboard-home__lower">
                <div className="dashboard-home__main">
                    <QuickActions />
                    <PerformanceSnapshot
                        stats={data.stats}
                        upcomingStreams={data.upcomingStreams}
                    />
                </div>

                <aside className="dashboard-home__aside">
                    <RecentActivity
                        recentFollows={data.recentFollows}
                        recentSubscriptions={data.recentSubscriptions}
                        recentGifts={data.recentGifts}
                    />
                </aside>
            </div>
        </div>
    )
}