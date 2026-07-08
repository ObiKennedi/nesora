// app/admin/layout.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Loader } from "@/component/essentials/Loader"
import { AdminSidebar } from "@/component/admin/AdminSidebar"
import "@/styles/admin/admin-shell.scss"

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session?.user?.id)            redirect("/login")
    if (session.user.role !== "ADMIN") redirect("/dashboard")

    return (
        <div className="admin-shell">
            <AdminSidebar
                name={session.user.name ?? "Admin"}
                image={session.user.image ?? null}
            />
            <main className="admin-shell__main">
                <Suspense fallback={<Loader />}>
                    {children}
                </Suspense>
            </main>
        </div>
    )
}