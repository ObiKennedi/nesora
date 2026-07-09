// app/admin/users/page.tsx
import { getUsersAction } from "@/actions/admin/users"
import { UsersDirectory } from "@/component/admin/UsersDirectory"
import "@/styles/admin/admin-users.scss"

const FILTERS = ["all", "creators", "fans", "suspended"] as const
type Filter = (typeof FILTERS)[number]

export default async function AdminUsersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; filter?: string; page?: string }>
}) {
    const params = await searchParams

    const filter: Filter = FILTERS.includes(params.filter as Filter)
        ? (params.filter as Filter)
        : "all"
    const page = Math.max(1, Number(params.page) || 1)
    const q    = params.q ?? ""

    const data = await getUsersAction({ q, filter, page })

    return (
        <div className="admin-users">
            <header className="admin-users__header">
                <h1 className="admin-users__title">Users</h1>
                <p className="admin-users__subtitle">
                    {data.total.toLocaleString()} account{data.total === 1 ? "" : "s"}
                    {q ? ` matching “${q}”` : ""}
                </p>
            </header>

            <UsersDirectory
                users={JSON.parse(JSON.stringify(data.users))}
                q={q}
                activeFilter={filter}
                page={data.page}
                pages={data.pages}
            />
        </div>
    )
}