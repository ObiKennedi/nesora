// app/(creator)/creator/dashboard/page.tsx
import { getDashboardData } from "@/actions/creator/dashboard"
import { DashboardHome } from "@/component/creator/dashboard/DashboardHome"

export default async function CreatorDashboardPage() {
    const data = await getDashboardData()
    return <DashboardHome data={data} />
}