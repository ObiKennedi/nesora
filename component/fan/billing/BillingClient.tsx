// component/fan/billing/BillingClient.tsx — Web Billing & Platform Membership Manager
"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import Link from "next/link"
import {
    Sparkles,
    CreditCard,
    CheckCircle2,
    Calendar,
    ExternalLink,
    ShieldCheck,
    Film,
    Zap,
    MessageSquare,
    Loader2,
    ArrowUpRight,
    ArrowDownLeft,
    Check,
    Plus,
    User,
} from "lucide-react"
import {
    initializeMembershipAction,
    verifyMembershipAction,
} from "@/actions/fan/subscription"
import { format } from "date-fns"

type MembershipStatus = {
    isPaidMember: boolean
    expiresAt:    Date | string | null
    price:        number
    interval:     string
    planName:     string
}

type CreatorSub = {
    id:         string
    status:     string
    startedAt:  Date | string
    expiresAt:  Date | string
    amountPaid: number
    plan:       { name: string; price: number; interval: string } | null
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        isVerified:  boolean
        image:       string | null
    }
}

type BillingTx = {
    id:          string
    amount:      number
    type:        string
    description: string | null
    createdAt:   Date | string
}

type Props = {
    membership:     MembershipStatus
    subscriptions:  CreatorSub[]
    walletBalance:  number
    billingHistory: BillingTx[]
}

const PLUS_PERKS = [
    {
        icon: Film,
        title: "Unlimited Content Access",
        desc: "Watch and browse all creator posts, photos, and videos with zero viewing limits.",
    },
    {
        icon: Zap,
        title: "Live Streams & Interactive Chat",
        desc: "Join creator live broadcasts with HD audio, video, and real-time chat interactions.",
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

export const BillingClient = ({
    membership: initialMembership,
    subscriptions,
    walletBalance,
    billingHistory,
}: Props) => {
    const [membership, setMembership] = useState<MembershipStatus>(initialMembership)
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
                setMembership((prev) => ({
                    ...prev,
                    isPaidMember: true,
                    expiresAt: res.expiresAt ?? null,
                }))
                setPendingRef(null)
                setMsg({ text: "Welcome to NESORA Plus! Your membership is active 🎉" })
            }
        })
    }

    return (
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 24px" }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#EA580C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Account & Subscriptions
                </span>
                <h1 style={{ fontSize: 30, fontWeight: 800, color: "#0F172A", marginTop: 4, letterSpacing: -0.5 }}>
                    Billing & Plans
                </h1>
                <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
                    Manage your NESORA Plus platform membership, creator subscriptions, and payment receipts.
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
                    }}
                >
                    {msg.text}
                </div>
            )}

            {/* ── 1. NESORA Plus Platform Membership Card ── */}
            <div
                style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 20,
                    border: membership.isPaidMember ? "2px solid #FED7AA" : "2px solid #EA580C",
                    padding: 28,
                    marginBottom: 36,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
                    <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, backgroundColor: "#FEF3C7", padding: "4px 12px", borderRadius: 999, marginBottom: 12 }}>
                            <Sparkles size={14} color="#B45309" />
                            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#B45309", letterSpacing: 0.5 }}>PLATFORM MEMBERSHIP</span>
                        </div>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A" }}>
                            {membership.isPaidMember ? "NESORA Plus Active" : "NESORA Plus Membership"}
                        </h2>
                        <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
                            {membership.isPaidMember
                                ? `Your monthly membership renews on ${membership.expiresAt ? format(new Date(membership.expiresAt), "MMMM dd, yyyy") : "next billing cycle"}.`
                                : "Upgrade for unlimited access to all creator feeds, full HD media, and live streams across web & mobile."
                            }
                        </p>
                    </div>

                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: "#EA580C" }}>
                            ₦5,000
                        </div>
                        <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>
                            per month · recurring billing
                        </span>
                    </div>
                </div>

                {/* Benefits Grid */}
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

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
                    {!membership.isPaidMember ? (
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
                                padding: "12px 24px",
                                borderRadius: 999,
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: isPending ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 12px rgba(234, 88, 12, 0.25)",
                            }}
                        >
                            {isPending ? (
                                <><Loader2 size={16} className="spin" /> Initializing Paystack…</>
                            ) : (
                                <><Sparkles size={16} /> Subscribe with Paystack (₦5,000/mo)</>
                            )}
                        </button>
                    ) : (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, backgroundColor: "#D1FAE5", padding: "10px 20px", borderRadius: 999, color: "#065F46", fontWeight: 700, fontSize: 13.5 }}>
                            <Check size={16} /> Active Member · Unlimited Access
                        </div>
                    )}

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
                                padding: "11px 20px",
                                borderRadius: 999,
                                fontSize: 13.5,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            <CheckCircle2 size={16} /> I've Completed Payment
                        </button>
                    )}
                </div>
            </div>

            {/* ── 2. Active Creator Subscriptions & Wallet Row ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginBottom: 36 }}>
                {/* Creator Subscriptions */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", padding: 22 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Creator Channels</h3>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", backgroundColor: "#F1F5F9", padding: "2px 8px", borderRadius: 999 }}>
                            {subscriptions.length} Subscribed
                        </span>
                    </div>

                    {subscriptions.length === 0 ? (
                        <div style={{ padding: "32px 16px", textAlign: "center", color: "#94A3B8" }}>
                            <User size={32} style={{ margin: "0 auto 8px auto", opacity: 0.6 }} />
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No Creator Subscriptions</div>
                            <div style={{ fontSize: 12, marginTop: 2 }}>Subscribe to individual creators to support them directly.</div>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {subscriptions.map((sub) => (
                                <div
                                    key={sub.id}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: 12,
                                        borderRadius: 12,
                                        backgroundColor: "#F8FAFC",
                                        border: "1px solid #F1F5F9",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        {sub.creator.image ? (
                                            <Image
                                                src={sub.creator.image}
                                                alt={sub.creator.displayName}
                                                width={38}
                                                height={38}
                                                style={{ borderRadius: 19, objectFit: "cover" }}
                                            />
                                        ) : (
                                            <div style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: "#FDEEE9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#EA580C" }}>
                                                {sub.creator.displayName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                                                {sub.creator.displayName}
                                            </div>
                                            <div style={{ fontSize: 11.5, color: "#64748B" }}>
                                                ₦{sub.amountPaid.toLocaleString()}/mo · Active
                                            </div>
                                        </div>
                                    </div>

                                    <Link
                                        href={`/fan/${sub.creator.handle || sub.creator.id}`}
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 600,
                                            color: "#475569",
                                            backgroundColor: "#FFFFFF",
                                            padding: "6px 12px",
                                            borderRadius: 999,
                                            border: "1px solid #E2E8F0",
                                            textDecoration: "none",
                                        }}
                                    >
                                        View
                                    </Link>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Wallet Balance Card */}
                <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>Wallet & Payment Method</h3>
                        <p style={{ fontSize: 12.5, color: "#64748B" }}>Use your balance for tips, gifts, and subscriptions.</p>

                        <div style={{ margin: "20px 0", padding: "18px 20px", backgroundColor: "#1E1715", borderRadius: 16, color: "#FFFFFF" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#A09794", letterSpacing: 1 }}>AVAILABLE BALANCE</div>
                            <div style={{ fontSize: 32, fontWeight: 900, marginTop: 4 }}>₦{walletBalance.toLocaleString()}</div>
                        </div>
                    </div>

                    <Link
                        href="/fan/wallet"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            backgroundColor: "#FFF7ED",
                            color: "#EA580C",
                            border: "1px solid #FED7AA",
                            padding: "10px 16px",
                            borderRadius: 12,
                            fontSize: 13.5,
                            fontWeight: 700,
                            textDecoration: "none",
                        }}
                    >
                        <Plus size={15} /> Top Up Wallet
                    </Link>
                </div>
            </div>

            {/* ── 3. Billing Receipts & Transaction History ── */}
            <div style={{ backgroundColor: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", padding: 24 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>Billing History & Invoices</h3>

                {billingHistory.length === 0 ? (
                    <div style={{ padding: "36px 16px", textAlign: "center", color: "#94A3B8" }}>
                        <CreditCard size={32} style={{ margin: "0 auto 8px auto", opacity: 0.6 }} />
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>No Billing History Yet</div>
                        <div style={{ fontSize: 12, marginTop: 2 }}>Invoices and subscription payment receipts will appear here.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid #E2E8F0", textAlign: "left", color: "#64748B", fontSize: 12 }}>
                                    <th style={{ padding: "10px 12px" }}>TRANSACTION</th>
                                    <th style={{ padding: "10px 12px" }}>DATE</th>
                                    <th style={{ padding: "10px 12px" }}>AMOUNT</th>
                                    <th style={{ padding: "10px 12px", textAlign: "right" }}>STATUS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {billingHistory.map((item) => {
                                    const isDeposit = item.type === "DEPOSIT"
                                    return (
                                        <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                            <td style={{ padding: "14px 12px", fontWeight: 600, color: "#0F172A" }}>
                                                {item.description || (isDeposit ? "Wallet Deposit" : "Subscription")}
                                            </td>
                                            <td style={{ padding: "14px 12px", color: "#64748B" }}>
                                                {format(new Date(item.createdAt), "MMM dd, yyyy")}
                                            </td>
                                            <td style={{ padding: "14px 12px", fontWeight: 700, color: "#0F172A" }}>
                                                ₦{item.amount.toLocaleString()}
                                            </td>
                                            <td style={{ padding: "14px 12px", textAlign: "right" }}>
                                                <span style={{ backgroundColor: "#D1FAE5", color: "#065F46", fontSize: 10.5, fontWeight: 800, padding: "2px 8px", borderRadius: 4 }}>
                                                    PAID
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
