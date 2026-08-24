// app/(auth)/error/page.tsx
"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CardWrapper } from "@/component/auth/CardWrapper"
import { Loader } from "@/component/essentials/Loader"
import {
    AlertTriangle,
    ShieldAlert,
    Clock,
    Link2Off,
    Lock,
    KeyRound,
    HelpCircle,
    ArrowLeft,
    RefreshCw,
} from "lucide-react"
import "@/styles/auth/AuthForm.scss"

interface ErrorDetail {
    title: string
    description: string
    hint?: string
    icon: React.ReactNode
    primaryAction: {
        label: string
        href: string
    }
    secondaryAction?: {
        label: string
        href: string
    }
}

const ERROR_MAP: Record<string, ErrorDetail> = {
    Configuration: {
        title: "Server Configuration Error",
        description:
            "There is a problem with the server authentication settings or provider credentials.",
        hint: "If this persists, please contact support or check server logs.",
        icon: <ShieldAlert size={32} />,
        primaryAction: { label: "Try signing in again", href: "/login" },
        secondaryAction: { label: "Contact Support", href: "mailto:support@nesora.org" },
    },
    AccessDenied: {
        title: "Access Denied",
        description:
            "You do not have permission to sign in, or your account may be suspended.",
        hint: "If you believe this is a mistake, please reach out to our team.",
        icon: <Lock size={32} />,
        primaryAction: { label: "Return to sign in", href: "/login" },
        secondaryAction: { label: "Support", href: "mailto:support@nesora.org" },
    },
    Verification: {
        title: "Link Expired or Invalid",
        description:
            "The sign-in or verification link has expired or has already been used.",
        hint: "Request a new link to continue.",
        icon: <Clock size={32} />,
        primaryAction: { label: "Request new link", href: "/forgot-password" },
        secondaryAction: { label: "Sign in with password", href: "/login" },
    },
    OAuthSignin: {
        title: "Could Not Start Sign-In",
        description:
            "An error occurred while attempting to connect to the login provider.",
        hint: "Please check your network connection and try again.",
        icon: <AlertTriangle size={32} />,
        primaryAction: { label: "Try again", href: "/login" },
    },
    OAuthCallback: {
        title: "Provider Authentication Failed",
        description:
            "We could not complete authentication with Google. You may have canceled the authorization prompt.",
        hint: "Try again or use standard email and password.",
        icon: <AlertTriangle size={32} />,
        primaryAction: { label: "Try again", href: "/login" },
        secondaryAction: { label: "Sign up with email", href: "/register" },
    },
    OAuthCreateAccount: {
        title: "Account Creation Failed",
        description:
            "Could not create an account with the selected third-party provider.",
        hint: "Try creating an account directly with your email.",
        icon: <ShieldAlert size={32} />,
        primaryAction: { label: "Register with email", href: "/register" },
        secondaryAction: { label: "Sign in", href: "/login" },
    },
    OAuthAccountNotLinked: {
        title: "Account Already Exists",
        description:
            "An account with this email address already exists using a different sign-in method.",
        hint: "Please sign in using your original method (e.g. password or Google).",
        icon: <Link2Off size={32} />,
        primaryAction: { label: "Sign in with password", href: "/login" },
    },
    EmailSignin: {
        title: "Email Sending Failed",
        description:
            "We were unable to deliver the authentication email to your inbox.",
        hint: "Please verify your email address spelling and try again.",
        icon: <AlertTriangle size={32} />,
        primaryAction: { label: "Try again", href: "/login" },
    },
    CredentialsSignin: {
        title: "Incorrect Email or Password",
        description:
            "The email address or password you entered does not match our records, or your email has not yet been verified.",
        hint: "Please double-check your spelling, or reset your password if you forgot it.",
        icon: <KeyRound size={32} />,
        primaryAction: { label: "Try signing in again", href: "/login" },
        secondaryAction: { label: "Forgot password? Reset here", href: "/forgot-password" },
    },
    SessionRequired: {
        title: "Session Expired",
        description:
            "Your session has expired or you need to sign in to access this page.",
        hint: "Sign in to continue where you left off.",
        icon: <Lock size={32} />,
        primaryAction: { label: "Sign in to continue", href: "/login" },
    },
}

const DEFAULT_ERROR: ErrorDetail = {
    title: "Authentication Error",
    description:
        "An unexpected problem occurred while verifying your authentication details.",
    hint: "Please try signing in again. If the issue persists, contact support.",
    icon: <HelpCircle size={32} />,
    primaryAction: { label: "Back to sign in", href: "/login" },
    secondaryAction: { label: "Go to Homepage", href: "/" },
}

function AuthErrorContent() {
    const searchParams = useSearchParams()
    const errorCode = searchParams.get("error") || "Default"
    const errorDetail = ERROR_MAP[errorCode] || DEFAULT_ERROR

    return (
        <CardWrapper
            heading="Authentication problem"
            subHeading="We encountered an issue while processing your request."
            showButton
            buttonLabel="Back to sign in"
            buttonLink="/login"
        >
            <div className="verify-state">
                <div className="verify-state__card verify-state__card--error">
                    {/* Icon */}
                    <div className="verify-state__icon-wrap verify-state__icon-wrap--error">
                        {errorDetail.icon}
                    </div>

                    {/* Error Code Pill */}
                    {errorCode && errorCode !== "Default" && (
                        <span
                            style={{
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "#b91c1c",
                                backgroundColor: "#fee2e2",
                                padding: "2px 8px",
                                borderRadius: "4px",
                            }}
                        >
                            Error: {errorCode}
                        </span>
                    )}

                    {/* Title & Description */}
                    <p className="verify-state__title">{errorDetail.title}</p>
                    <p className="verify-state__body">{errorDetail.description}</p>

                    {/* Hint */}
                    {errorDetail.hint && (
                        <p className="verify-state__hint" style={{ marginTop: "4px" }}>
                            {errorDetail.hint}
                        </p>
                    )}

                    {/* Action Buttons */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            width: "100%",
                            marginTop: "16px",
                        }}
                    >
                        <Link
                            href={errorDetail.primaryAction.href}
                            className="auth-submit"
                            style={{
                                textDecoration: "none",
                                textAlign: "center",
                                margin: 0,
                            }}
                        >
                            <RefreshCw size={15} />
                            {errorDetail.primaryAction.label}
                        </Link>

                        {errorDetail.secondaryAction && (
                            <Link
                                href={errorDetail.secondaryAction.href}
                                className="verify-state__link"
                                style={{
                                    textAlign: "center",
                                    padding: "8px",
                                    fontSize: "0.85rem",
                                }}
                            >
                                {errorDetail.secondaryAction.label}
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </CardWrapper>
    )
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={<Loader fullscreen={false} message="Loading error details…" />}>
            <AuthErrorContent />
        </Suspense>
    )
}
