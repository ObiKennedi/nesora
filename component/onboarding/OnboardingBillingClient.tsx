// component/onboarding/OnboardingBillingClient.tsx — New Sign-Up Web Billing Plans Showcase
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
    Sparkles,
    Check,
    Film,
    Zap,
    MessageSquare,
    ShieldCheck,
    CheckCircle2,
    ArrowRight,
    Loader2,
} from "lucide-react"
import {
    initializeMembershipAction,
    verifyMembershipAction,
} from "@/actions/fan/subscription"

const PLUS_PERKS = [
    {
        icon: Film,
        title: "Unlimited Content Access",
        desc: "Watch and browse all creator feeds, full HD photos, and videos with zero limits.",
    },
    {
        icon: Zap,
        title: "Live Streams & Real-time Chat",
        desc: "Join creator live broadcasts, participate in real-time chat, and react.",
    },
    {
        icon: MessageSquare,
        title: "Priority Direct Messaging",
        desc: "Send direct messages and message requests to creators you follow.",
    },
    {
        icon: ShieldCheck,
        title: "Verified Member Badge",
        desc: "Stand out across comments and live chats with your NESORA Plus badge.",
    },
]

export const OnboardingBillingClient = () => {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [pendingRef, setPendingRef] = useState<string | null>(null)
    const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

    const handleSubscribe = () => {
        setMsg(null)
        startTransition(async () => {
            const res = await initializeMembershipAction()
            if (res.error) {
                setMsg({ text: res.error, error: true })
                return
            }
            if (res.authorizationUrl) {
                setPendingRef(res.reference ?? null)
                window.open(res.authorizationUrl, "_blank")
            }
        })
    }

    const handleVerify = () => {
        if (!pendingRef) return
        setMsg(null)
        startTransition(async () => {
            const res = await verifyMembershipAction(pendingRef)
            if (res.error) {
                setMsg({ text: res.error, error: true })
                return
            }
            if (res.isPaidMember) {
                router.push("/fan/feed")
            }
        })
    }

    const handleSkip = () => {
        router.push("/fan/feed")
    }

    return (
        <div style={{ maxWidth: 840, margin: "0 auto", padding: "40px 24px" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 36 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#FEF3C7", padding: "4px 14px", borderRadius: 999, marginBottom: 12 }}>
                    <Sparkles size={14} color="#B45309" />
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: "#B45309", letterSpacing: 0.6 }}>MEMBERSHIP PLANS</span>
                </div>
                <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0F172A", letterSpacing: -0.5 }}>
                    Choose Your NESORA Experience
                </h1>
                <p style={{ fontSize: 15, color: "#64748B", marginTop: 6, maxWidth: 520, margin: "6px auto 0 auto" }}>
                    Unlock unlimited access to all creator feeds, full HD media, and interactive live broadcasts.
                </p>
            </div>

            {msg && (
                <div
                    style={{
                        padding: "14px 18px",
                        borderRadius: 12,
                        marginBottom: 24,
                        backgroundColor: msg.error ? "#FEF2F2" : "#ECFDF5",
                        border: `1px solid ${msg.error ? "#FECACA" : "#A7F3D0"}`,
                        color: msg.error ? "#DC2626" : "#065F46",
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: "center",
                    }}
                >
                    {msg.text}
                </div>
            )}

            {/* Featured Card */}
            <div
                style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 24,
                    border: "2px solid #EA580C",
                    padding: 32,
                    marginBottom: 24,
                    boxShadow: "0 8px 30px rgba(234, 88, 12, 0.08)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ display: "inline-block", backgroundColor: "#EA580C", color: "#FFFFFF", fontSize: 10.5, fontWeight: 800, padding: "3px 10px", borderRadius: 999, marginBottom: 8 }}>
                            RECOMMENDED
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }}>NESORA Plus</h2>
                        <p style={{ fontSize: 13.5, color: "#64748B", marginTop: 2 }}>Full Unlimited Platform Access</p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 36, fontWeight: 900, color: "#EA580C" }}>₦5,000</div>
                        <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>/ month · recurring billing</span>
                    </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24, paddingTop: 24, borderTop: "1px solid #F1F5F9" }}>
                    {PLUS_PERKS.map((p, i) => {
                        const Icon = p.icon
                        return (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, backgroundColor: "#F8FAFC", padding: 16, borderRadius: 14 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                    <Icon size={18} color="#EA580C" />
                                </div>
                                <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1E293B" }}>{p.title}</div>
                                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2, lineHeight: "16px" }}>{p.desc}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
                    <button
                        onClick={handleSubscribe}
                        disabled={isPending}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            backgroundColor: "#EA580C",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "14px 28px",
                            borderRadius: 999,
                            fontSize: 14.5,
                            fontWeight: 700,
                            cursor: isPending ? "not-allowed" : "pointer",
                            boxShadow: "0 4px 14px rgba(234, 88, 12, 0.28)",
                        }}
                    >
                        {isPending ? (
                            <><Loader2 size={16} className="spin" /> Starting checkout…</>
                        ) : (
                            <><Sparkles size={16} /> Subscribe with Paystack (₦5,000/mo)</>
                        )}
                    </button>

                    {pendingRef && (
                        <button
                            onClick={handleVerify}
                            disabled={isPending}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                backgroundColor: "#FFF7ED",
                                color: "#EA580C",
                                border: "1.5px solid #EA580C",
                                padding: "12px 22px",
                                borderRadius: 999,
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            <CheckCircle2 size={16} /> I've Completed Payment
                        </button>
                    )}
                </div>
            </div>

            {/* Free Plan Option */}
            <div
                style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 18,
                    border: "1px solid #E2E8F0",
                    padding: "20px 24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 14,
                }}
            >
                <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#334155" }}>Free Limited Plan</h3>
                    <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                        Preview creator public posts with limited access.
                    </p>
                </div>

                <button
                    onClick={handleSkip}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        backgroundColor: "#F1F5F9",
                        color: "#475569",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: 999,
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Continue with Free Plan <ArrowRight size={15} />
                </button>
            </div>
        </div>
    )
}
