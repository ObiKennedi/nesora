"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2, CircleCheck, CircleX } from "lucide-react"
import Link from "next/link"
import { loginAction } from "@/actions/auth/login"
import { CardWrapper } from "./CardWrapper"
import "@/styles/auth/AuthForm.scss"

const LoginSchema = z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof LoginSchema>

export const LoginForm = () => {

    const [showPw, setShowPw] = useState(false)
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginValues>({ resolver: zodResolver(LoginSchema) })

    const onSubmit = (values: LoginValues) => {
        setFeedback(null)
        startTransition(async () => {
            const res = await loginAction(values)
            if (res?.error) setFeedback({ type: "error", message: res.error })
        })
    }

    return (
        <CardWrapper
            heading="Welcome back"
            subHeading="Sign in to your NESORA account."
            showSocials
            showButton
            buttonLabel="Don't have an account? Sign up"
            buttonLink="/register"
        >
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="auth-form"
                noValidate
            >
                {/* ── Email ── */}
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

                {/* ── Password ── */}
                <div className="auth-field">
                    <div className="auth-field__label-row">
                        <label htmlFor="password">Password</label>
                        <Link
                            href="/forgot-password"
                            className="auth-field__forgot"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="auth-field__input-wrap">
                        <input
                            id="password"
                            type={showPw ? "text" : "password"}
                            placeholder="Enter your password"
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
                    {errors.password && (
                        <span className="auth-field__error">
                            {errors.password.message}
                        </span>
                    )}
                </div>

                {/* ── Feedback ── */}
                {feedback && (
                    <div className={`auth-feedback auth-feedback--${feedback.type}`}>
                        {feedback.type === "success"
                            ? <CircleCheck size={15} />
                            : <CircleX size={15} />
                        }
                        <span>{feedback.message}</span>
                    </div>
                )}

                {/* ── Submit ── */}
                <button
                    type="submit"
                    className="auth-submit"
                    disabled={isPending}
                >
                    {isPending
                        ? <><Loader2 size={16} className="spin" /> Signing in…</>
                        : "Sign In"
                    }
                </button>
            </form>
        </CardWrapper>
    )
}