// app/(auth)/forgot-password/page.tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, CircleCheck, CircleX, Mail } from "lucide-react"
import { forgotPasswordAction } from "@/actions/auth/forgot-password"
import { CardWrapper } from "@/component/auth/CardWrapper"
import "@/styles/auth/AuthForm.scss"

const ForgotSchema = z.object({
    email: z.string().email("Enter a valid email address"),
})

type ForgotValues = z.infer<typeof ForgotSchema>

const ForgotPasswordPage = () => {

    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotValues>({ resolver: zodResolver(ForgotSchema) })

    const onSubmit = (values: ForgotValues) => {
        setFeedback(null)
        startTransition(async () => {
            const res = await forgotPasswordAction(values)
            if (res?.error) setFeedback({ type: "error", message: res.error })
            if (res?.success) setFeedback({ type: "success", message: res.success })
        })
    }

    return (
        <CardWrapper
            heading="Forgot password?"
            subHeading="Enter your email and we'll send you a reset link."
            showButton
            buttonLabel="Back to sign in"
            buttonLink="/login"
        >
            {/* ── Success state ── */}
            {feedback?.type === "success" ? (
                <div className="verify-state">
                    <div className="verify-state__card verify-state__card--success">
                        <div className="verify-state__icon-wrap verify-state__icon-wrap--success">
                            <Mail size={28} />
                        </div>
                        <p className="verify-state__title">Check your inbox</p>
                        <p className="verify-state__body">{feedback.message}</p>
                        <p className="verify-state__hint">
                            Didn't get it? Check your spam folder or{" "}
                            <button
                                className="verify-state__link"
                                onClick={() => {
                                    setFeedback(null)
                                }}
                            >
                                try again
                            </button>
                            .
                        </p>
                    </div>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="auth-form"
                    noValidate
                >
                    <div className="auth-field">
                        <label htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            type="email"
                            placeholder="ada@example.com"
                            disabled={isPending}
                            {...register("email")}
                            className={errors.email ? "input--error" : ""}
                        />
                        {errors.email && (
                            <span className="auth-field__error">
                                {errors.email.message}
                            </span>
                        )}
                    </div>

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
                            ? <><Loader2 size={16} className="spin" /> Sending link…</>
                            : "Send Reset Link"
                        }
                    </button>
                </form>
            )}
        </CardWrapper>
    )
}

export default ForgotPasswordPage