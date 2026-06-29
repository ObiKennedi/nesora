"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"

export const BackButton = ({ fallback = "/" }: { fallback?: string }) => {
    const router = useRouter()
    const [canGoBack, setCanGoBack] = useState(false)

    // history.length > 1 means we arrived here via an in-app navigation,
    // so router.back() will land on the referring page. On a direct visit
    // (new tab / shared link) it's 1, and we send them to the fallback.
    useEffect(() => {
        setCanGoBack(window.history.length > 1)
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