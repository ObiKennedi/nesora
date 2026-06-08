"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Loader2, CircleCheck, CircleX } from "lucide-react"
import { registerAction } from "@/actions/auth/register"
import { CardWrapper } from "./CardWrapper"
import "@/styles/auth/AuthForm.scss"

const RegisterSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Must contain an uppercase letter")
        .regex(/[0-9]/, "Must contain a number")
        .regex(/[^a-zA-Z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

type RegisterValues = z.infer<typeof RegisterSchema>

// ── Password strength indicator ───────────────────────────────────────────────

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

export const RegisterForm = () => {

    const [showPw, setShowPw] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)
    const [isPending, startTransition] = useTransition()

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm<RegisterValues>({ resolver: zodResolver(RegisterSchema) })

    const passwordValue = watch("password", "")
    const strength = getStrength(passwordValue)

    const onSubmit = (values: RegisterValues) => {
        setFeedback(null)
        startTransition(async () => {
            const res = await registerAction({
                firstName: values.firstName,
                lastName: values.lastName,
                email: values.email,
                password: values.password,
            })
            if (res?.error) setFeedback({ type: "error", message: res.error })
            if (res?.success) setFeedback({ type: "success", message: res.success })
        })
    }

    return (
        <CardWrapper
            heading="Create your account"
            subHeading="Join thousands of creators and fans on NESORA."
            showSocials
            showButton
            buttonLabel="Already have an account? Sign in"
            buttonLink="/login"
        >
            <form
                onSubmit={handleSubmit(onSubmit)}
                className="auth-form"
                noValidate
            >
                {/* ── Name row ── */}
                <div className="auth-form__row">
                    <div className="auth-field">
                        <label htmlFor="firstName">First Name</label>
                        <input
                            id="firstName"
                            type="text"
                            placeholder="Ada"
                            disabled={isPending}
                            {...register("firstName")}
                            className={errors.firstName ? "input--error" : ""}
                        />
                        {errors.firstName && (
                            <span className="auth-field__error">
                                {errors.firstName.message}
                            </span>
                        )}
                    </div>

                    <div className="auth-field">
                        <label htmlFor="lastName">Last Name</label>
                        <input
                            id="lastName"
                            type="text"
                            placeholder="Okafor"
                            disabled={isPending}
                            {...register("lastName")}
                            className={errors.lastName ? "input--error" : ""}
                        />
                        {errors.lastName && (
                            <span className="auth-field__error">
                                {errors.lastName.message}
                            </span>
                        )}
                    </div>
                </div>

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
                    <label htmlFor="password">Password</label>
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

                    {/* Strength meter */}
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
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <div className="auth-field__input-wrap">
                        <input
                            id="confirmPassword"
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repeat your password"
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
                        ? <><Loader2 size={16} className="spin" /> Creating account…</>
                        : "Create Account"
                    }
                </button>
            </form>
        </CardWrapper>
    )
}