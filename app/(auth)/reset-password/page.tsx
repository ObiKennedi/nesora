// app/(auth)/reset-password/page.tsx
"use client"

import { useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2, CircleCheck, CircleX } from "lucide-react"
import { resetPasswordAction } from "@/actions/auth/forgot-password"
import { CardWrapper } from "@/component/auth/CardWrapper"
import "@/styles/auth/AuthForm.scss"

const ResetSchema = z.object({
    password: z.string()
        .min(8, "Must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number")
        .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

type ResetValues = z.infer<typeof ResetSchema>

// ── Re-use strength helpers from RegisterForm ─────────────────────────────────

const getStrength = (pw: string) => {
    let score = 0
    if (pw.length >= 8) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^a-zA-Z0-9]/.test(pw)) score++
    return score
}

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"]
const strengthClass = ["", "weak", "fair", "good", "strong"]

const ResetPasswordPage = () => {

    const searchParams = useSearchParams()
    const token = searchParams.get("token")

    const [showPw, setShowPw] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<ResetValues>({ resolver: zodResolver(ResetSchema) })

    const passwordValue = watch("password", "")
    const strength = getStrength(passwordValue)

    const onSubmit = (values: ResetValues) => {
        if (!token) {
            setFeedback({ type: "error", message: "Invalid or missing reset token." })
            return
        }

        setFeedback(null)
        startTransition(async () => {
            const res = await resetPasswordAction({
                token,
                password: values.password,
            })
            if (res?.error) setFeedback({ type: "error", message: res.error })
            if (res?.success) setFeedback({ type: "success", message: res.success })
        })
    }

    // ── Invalid / missing token ───────────────────────────────────────────────
    if (!token) {
        return (
            <CardWrapper
                heading="Invalid link"
                subHeading="This password reset link is invalid or has expired."
                showButton
                buttonLabel="Request a new link"
                buttonLink="/forgot-password"
            >
                <div className="verify-state">
                    <div className="verify-state__card verify-state__card--error">
                        <div className="verify-state__icon-wrap verify-state__icon-wrap--error">
                            <CircleX size={28} />
                        </div>
                        <p className="verify-state__title">Link expired</p>
                        <p className="verify-state__body">
                            Reset links expire after 1 hour. Request a new one below.
                        </p>
                    </div>
                </div>
            </CardWrapper>
        )
    }

    // ── Success state ─────────────────────────────────────────────────────────
    if (feedback?.type === "success") {
        return (
            <CardWrapper
                heading="Password updated"
                subHeading="Your password has been reset successfully."
                showButton
                buttonLabel="Sign in to your account"
                buttonLink="/login"
            >
                <div className="verify-state">
                    <div className="verify-state__card verify-state__card--success">
                        <div className="verify-state__icon-wrap verify-state__icon-wrap--success">
                            <CircleCheck size={28} />
                        </div>
                        <p className="verify-state__title">All done!</p>
                        <p className="verify-state__body">{feedback.message}</p>
                    </div>
                </div>
            </CardWrapper>
        )
    }

    return (
        <CardWrapper
            heading="Reset password"
            subHeading="Choose a new password for your NESORA account."
            showButton
            buttonLabel="Back to sign in"
            buttonLink="/login"
        >
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="auth-form"
                noValidate
            >
                {/* ── New Password ── */}
                <div className="auth-field">
                    <label htmlFor="password">New Password</label>
                    <div className="auth-field__input-wrap">
                        <input
                            id="password"
                            type={showPw ? "text" : "password"}
                            placeholder="Create a strong password"
                            disabled={isPending}
                            {...register("password")}
                            className={errors.password ? "input--error" : ""}
                        />
                        <button
                            type="button"
                            className="auth-field__toggle"
                            onClick={() => setShowPw((v) => !v)}
                            tabIndex={-1}
                            aria-label={showPw ? "Hide password" : "Show password"}
                        >
                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    {passwordValue.length > 0 && (
                        <div className="auth-strength">
                            <div className="auth-strength__bars">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className={`auth-strength__bar ${i <= strength
                                            ? `auth-strength__bar--${strengthClass[strength]}`
                                            : ""
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className={`auth-strength__label auth-strength__label--${strengthClass[strength]}`}>
                                {strengthLabel[strength]}
                            </span>
                        </div>
                    )}

                    {errors.password && (
                        <span className="auth-field__error">
                            {errors.password.message}
                        </span>
                    )}
                </div>

                {/* ── Confirm Password ── */}
                <div className="auth-field">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <div className="auth-field__input-wrap">
                        <input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repeat your new password"
                            disabled={isPending}
                            {...register("confirmPassword")}
                            className={errors.confirmPassword ? "input--error" : ""}
                        />
                        <button
                            type="button"
                            className="auth-field__toggle"
                            onClick={() => setShowConfirm((v) => !v)}
                            tabIndex={-1}
                            aria-label={showConfirm ? "Hide password" : "Show password"}
                        >
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {errors.confirmPassword && (
                        <span className="auth-field__error">
                            {errors.confirmPassword.message}
                        </span>
                    )}
                </div>

                {/* ── Error feedback ── */}
                {feedback?.type === "error" && (
                    <div className="auth-feedback auth-feedback--error">
                        <CircleX size={15} />
                        <span>{feedback.message}</span>
                    </div>
                )}

                <button
                    type="submit"
                    className="auth-submit"
                    disabled={isPending}
                >
                    {isPending
                        ? <><Loader2 size={16} className="spin" /> Updating password…</>
                        : "Update Password"
                    }
                </button>
            </form>
        </CardWrapper>
    )
}

export default ResetPasswordPage