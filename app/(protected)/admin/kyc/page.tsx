// app/admin/kyc/page.tsx
import { getKycQueueAction } from "@/actions/admin/kyc"
import { KycQueue } from "@/component/admin/KycQueue"
import "@/styles/admin/admin-kyc.scss"

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const
type Status = (typeof STATUSES)[number]

export default async function AdminKycPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string; page?: string }>
}) {
    const params = await searchParams

    const status: Status = STATUSES.includes(params.status as Status)
        ? (params.status as Status)
        : "PENDING"
    const page = Math.max(1, Number(params.page) || 1)

    const data = await getKycQueueAction({ status, page })

    return (
        <div className="admin-kyc">
            <header className="admin-kyc__header">
                <h1 className="admin-kyc__title">KYC Review</h1>
                <p className="admin-kyc__subtitle">
                    {data.pendingCount} verification{data.pendingCount === 1 ? "" : "s"} awaiting review
                </p>
            </header>

            <KycQueue
                verifications={JSON.parse(JSON.stringify(data.verifications))}
                activeStatus={status}
                page={data.page}
                pages={data.pages}
            />
        </div>
    )
}