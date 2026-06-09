// app/dashboard/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader } from "@/component/essentials/Loader"

export default function DashboardRedirectPage() {
    const { data: session, status } = useSession()
    const router = useRouter()

    useEffect(() => {
        if (status === "loading") return

        // Not logged in
        if (!session) {
            router.replace("/login")
            return
        }

        const role = session.user?.role
        const onboardingType = session.user?.onboardingType

        // ── Admin ─────────────────────────────────────────────────────────────
        if (role === "ADMIN") {
            router.replace("/admin")
            return
        }

        // ── No onboarding type yet — send to pick ─────────────────────────────
        if (!onboardingType) {
            router.replace("/onboarding")
            return
        }

        // ── Creator ───────────────────────────────────────────────────────────
        if (onboardingType === "CREATOR") {
            router.replace("/creator/dashboard")
            return
        }

        // ── Fan ───────────────────────────────────────────────────────────────
        if (onboardingType === "FAN") {
            router.replace("/feed")
            return
        }

        // Fallback
        router.replace("/login")

    }, [session, status, router])

    return (
        <Loader
            fullscreen
            message="Verifying your session…"
        />
    )
}