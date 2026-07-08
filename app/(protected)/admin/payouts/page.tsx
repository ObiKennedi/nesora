// app/admin/payouts/page.tsx
import { getWithdrawalQueueAction } from "@/actions/admin/withdrawals"
import { PayoutsQueue } from "@/component/admin/PayoutsQueue"
import "@/styles/admin/admin-payouts.scss"

const STATUSES = ["PENDING", "PROCESSING", "PAID", "REJECTED", "FAILED"] as const
type Status = (typeof STATUSES)[number]

export default async function AdminPayoutsPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; page?: string }>
}) {
    const params = await searchParams

    const status: Status = STATUSES.includes(params.status as Status)
        ? (params.status as Status)
        : "PENDING"
    const page = Math.max(1, Number(params.page) || 1)

    const data = await getWithdrawalQueueAction({ status, page })

    return (
        <div className="admin-payouts">
            <header className="admin-payouts__header">
                <div>
                    <h1 className="admin-payouts__title">Payouts</h1>
                    <p className="admin-payouts__subtitle">
                        {data.queueStats.pendingCount} pending ·
                        ₦{data.queueStats.pendingTotal.toLocaleString()} awaiting approval
                    </p>
                </div>
            </header>

            <PayoutsQueue
                withdrawals={JSON.parse(JSON.stringify(data.withdrawals))}
                activeStatus={status}
                page={data.page}
                pages={data.pages}
            />
        </div>
    )
}