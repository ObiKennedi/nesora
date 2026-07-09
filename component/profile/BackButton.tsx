"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"

export const BackButton = ({ fallback = "/feed" }: { fallback?: string }) => {
    const router = useRouter()
    const [canGoBack, setCanGoBack] = useState(false)

    useEffect(() => {
        setCanGoBack((window.history.state?.idx ?? 0) > 0)
    }, [])

    const handleBack = () => {
        if (canGoBack) router.back()
        else router.push(fallback)
    }

    return (
        <button type="button" onClick={handleBack} className="profile-view__back">
            <ArrowLeft size={16} />
            Back
        </button>
    )
}