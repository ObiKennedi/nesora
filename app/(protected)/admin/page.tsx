// app/admin/page.tsx
import Link from "next/link"
import { getAdminOverviewAction } from "@/actions/admin/overview"
import { VolumeChart } from "@/component/admin/VolumeChart"
import { Banknote, ShieldCheck, ArrowRight } from "lucide-react"
import "@/styles/admin/admin-overview.scss"

const naira = (v: number) => `₦${v.toLocaleString()}`

export default async function AdminOverviewPage() {
    const { stats, queues, chart } = await getAdminOverviewAction()

    const cards = [
        { label: "Gross volume",        value: naira(stats.grossVolume),  hint: "All fan spend, all time" },
        { label: "Fees collected",      value: naira(stats.feesCollected), hint: "Withdrawal + call fees" },
        { label: "Paid out",            value: naira(stats.totalPaidOut), hint: "Net to creators" },
        { label: "Users",               value: stats.totalUsers.toLocaleString(), hint: `+${stats.newUsers30d.toLocaleString()} in 30 days` },
        { label: "Creators",            value: stats.totalCreators.toLocaleString(), hint: `${stats.verifiedCreators.toLocaleString()} verified` },
        { label: "Active subscriptions", value: stats.activeSubscriptions.toLocaleString(), hint: stats.liveStreamsNow > 0 ? `${stats.liveStreamsNow} live now` : "—" },
    ]

    return (
        <div className="admin-overview">
            <header className="admin-overview__header">
                <h1 className="admin-overview__title">Overview</h1>
                <p className="admin-overview__subtitle">Platform health at a glance</p>
            </header>

            {/* ── Action queues ── */}
            <div className="admin-overview__queues">
                <Link href="/admin/payouts" className="admin-overview__queue">
                    <Banknote className="admin-overview__queue-icon" size={20} />
                    <div className="admin-overview__queue-info">
                        <span className="admin-overview__queue-count">
                            {queues.pendingWithdrawalCount} pending payout{queues.pendingWithdrawalCount === 1 ? "" : "s"}
                        </span>
                        <span className="admin-overview__queue-meta">
                            {naira(queues.pendingWithdrawalAmount)} awaiting approval
                        </span>
                    </div>
                    <ArrowRight size={16} className="admin-overview__queue-arrow" />
                </Link>

                <Link href="/admin/kyc" className="admin-overview__queue">
                    <ShieldCheck className="admin-overview__queue-icon" size={20} />
                    <div className="admin-overview__queue-info">
                        <span className="admin-overview__queue-count">
                            {queues.pendingKycCount} KYC application{queues.pendingKycCount === 1 ? "" : "s"}
                        </span>
                        <span className="admin-overview__queue-meta">awaiting review</span>
                    </div>
                    <ArrowRight size={16} className="admin-overview__queue-arrow" />
                </Link>
            </div>

            {/* ── Stat cards ── */}
            <div className="admin-overview__grid">
                {cards.map((c) => (
                    <div key={c.label} className="admin-overview__card">
                        <span className="admin-overview__card-label">{c.label}</span>
                        <span className="admin-overview__card-value">{c.value}</span>
                        <span className="admin-overview__card-hint">{c.hint}</span>
                    </div>
                ))}
            </div>

            {/* ── Volume chart ── */}
            <section className="admin-overview__chart">
                <h2 className="admin-overview__chart-title">Platform volume · last 6 months</h2>
                <VolumeChart data={chart} />
            </section>
        </div>
    )
}