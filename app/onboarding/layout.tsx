// app/onboarding/layout.tsx
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Loader } from "@/component/essentials/Loader"
import { Suspense } from "react"
import "@/styles/onboarding/OnboardingLayout.scss"

export default async function OnboardingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()
    if (!session?.user) redirect("/login")

    return (
        <div className="onboarding-layout">

            {/* ── Brand bar ── */}
            <header className="onboarding-header">
                <a href="/" className="onboarding-header__logo">
                    <img src="/logo.png" alt="NESORA" />
                </a>
            </header>

            {/* ── Content ── */}
            <main className="onboarding-main">
                <Suspense fallback={<Loader fullscreen={false} message="Loading…" />}>
                    {children}
                </Suspense>
            </main>

            {/* ── Footer ── */}
            <footer className="onboarding-footer">
                <p>© {new Date().getFullYear()} NESORA. All rights reserved.</p>
                <div>
                    <a href="/terms">Terms</a>
                    <a href="/privacy">Privacy</a>
                </div>
            </footer>

        </div>
    )
}