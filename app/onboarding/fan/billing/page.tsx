// app/onboarding/fan/billing/page.tsx — Web Fan Onboarding Billing Plans Step
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { OnboardingBillingClient } from "@/component/onboarding/OnboardingBillingClient"

export const metadata = {
    title: "Choose Your Plan · NESORA",
    description: "Select your NESORA membership plan.",
}

export default async function OnboardingBillingPage() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    return <OnboardingBillingClient />
}
