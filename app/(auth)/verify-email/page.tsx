// app/(auth)/verify-email/page.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { verifyEmailAction } from "@/actions/auth/verify-email"
import { CardWrapper } from "@/component/auth/CardWrapper"
import { Loader2, MailCheck, CircleX } from "lucide-react"
import "@/styles/auth/AuthForm.scss"

const VerifyEmailPage = () => {

    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
    const [message, setMessage] = useState("")
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        if (!token) {
            setStatus("error")
            setMessage("No verification token found. Check your email link.")
            return
        }

        setStatus("loading")
        startTransition(async () => {
            const res = await verifyEmailAction(token)
            if (res?.error) {
                setStatus("error")
                setMessage(res.error)
            }
            // success redirects server-side to /login?verified=true
        })
    }, [token])

    return (
        <CardWrapper
            heading="Verify your email"
            subHeading="We sent a verification link to your email address."
            buttonLink="/login"
            showButton
            buttonLabel="Back to sign in"
        >
            <div className="verify-state">

                {(status === "idle" || status === "loading") && (
                    <div className="verify-state__card verify-state__card--loading">
                        <div className="verify-state__icon-wrap verify-state__icon-wrap--spin">
                            <Loader2 size={28} />
                        </div>
                        <p className="verify-state__title">Verifying your email…</p>
                        <p className="verify-state__body">
                            Please wait while we confirm your account.
                        </p>
                    </div>
                )}

                {status === "success" && (
                    <div className="verify-state__card verify-state__card--success">
                        <div className="verify-state__icon-wrap verify-state__icon-wrap--success">
                            <MailCheck size={28} />
                        </div>
                        <p className="verify-state__title">Email verified!</p>
                        <p className="verify-state__body">
                            Your account is confirmed. Redirecting you to sign in…
                        </p>
                    </div>
                )}

                {status === "error" && (
                    <div className="verify-state__card verify-state__card--error">
                        <div className="verify-state__icon-wrap verify-state__icon-wrap--error">
                            <CircleX size={28} />
                        </div>
                        <p className="verify-state__title">Verification failed</p>
                        <p className="verify-state__body">{message}</p>
                        <a href="/register" className="verify-state__link">
                            Create a new account
                        </a>
                    </div>
                )}

            </div>
        </CardWrapper>
    )
}

export default VerifyEmailPage