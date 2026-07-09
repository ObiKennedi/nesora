// app/admin/audit/page.tsx
import { getAuditLogAction } from "@/actions/admin/audit"
import { AuditLog } from "@/component/admin/AuditLog"
import "@/styles/admin/admin-audit.scss"

const CATEGORIES = ["all", "withdrawal", "kyc", "user"] as const
type Category = (typeof CATEGORIES)[number]

export default async function AdminAuditPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; admin?: string; target?: string; page?: string }>
}) {
    const params = await searchParams

    const category: Category = CATEGORIES.includes(params.category as Category)
        ? (params.category as Category)
        : "all"
    const page = Math.max(1, Number(params.page) || 1)

    const data = await getAuditLogAction({
        category,
        adminId:  params.admin,
        targetId: params.target,
        page,
    })

    return (
        <div className="admin-audit">
            <header className="admin-audit__header">
                <h1 className="admin-audit__title">Audit Log</h1>
                <p className="admin-audit__subtitle">
                    {data.total.toLocaleString()} recorded action{data.total === 1 ? "" : "s"}
                </p>
            </header>

            <AuditLog
                entries={JSON.parse(JSON.stringify(data.entries))}
                admins={data.admins}
                activeCategory={category}
                activeAdminId={params.admin ?? ""}
                targetQuery={params.target ?? ""}
                page={data.page}
                pages={data.pages}
            />
        </div>
    )
}