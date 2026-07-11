// component/creator-profile/SubscribeModal.tsx
"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { X, Check, Loader2, Wallet } from "lucide-react"
import { subscribeToPlanAction } from "@/actions/fan/subscription" // ← adjust to your actual path

type Plan = {
    id:       string
    name:     string
    price:    number
    interval: string
    benefits: string[]
}

type Props = {
    creatorId:    string
    creatorName:  string
    plans:        Plan[]
    onClose:      () => void
    onSubscribed: () => void
}

const naira = new Intl.NumberFormat("en-NG", {
    style:                 "currency",
    currency:              "NGN",
    minimumFractionDigits: 0,
})

export default function SubscribeModal({ creatorId, creatorName, plans, onClose, onSubscribed }: Props) {
    const [isPending, startTransition] = useTransition()
    const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "")
    const [error, setError]         = useState<string | null>(null)
    const [shortfall, setShortfall] = useState<number | null>(null)

    const handleSubscribe = () => {
        if (!selectedPlanId || isPending) return
        setError(null)
        setShortfall(null)

        startTransition(async () => {
            const result = await subscribeToPlanAction({ creatorId, planId: selectedPlanId })

            if ("success" in result && result.success) {
                onSubscribed()
                return
            }

            if ("error" in result) {
                if (result.error === "INSUFFICIENT_FUNDS" && "shortfall" in result) {
                    setShortfall(result.shortfall ?? null)
                } else {
                    setError(result.error ?? "An error occurred")
                }
            }
        })
    }

    return (
        <div className="subscribe-modal" role="dialog" aria-modal="true" aria-label={`Subscribe to ${creatorName}`}>
            <div className="subscribe-modal__backdrop" onClick={onClose} />

            <div className="subscribe-modal__panel">
                <div className="subscribe-modal__header">
                    <h2>Subscribe to {creatorName}</h2>
                    <button type="button" className="subscribe-modal__close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                <div className="subscribe-modal__plans">
                    {plans.map((plan) => (
                        <button
                            key={plan.id}
                            type="button"
                            className={`subscribe-modal__plan ${selectedPlanId === plan.id ? "subscribe-modal__plan--selected" : ""}`}
                            onClick={() => setSelectedPlanId(plan.id)}
                        >
                            <div className="subscribe-modal__plan-head">
                                <span className="subscribe-modal__plan-name">{plan.name}</span>
                                <span className="subscribe-modal__plan-price">
                                    {naira.format(plan.price)}
                                    <small>/{plan.interval === "yearly" ? "yr" : "mo"}</small>
                                </span>
                            </div>
                            {plan.benefits.length > 0 && (
                                <ul className="subscribe-modal__plan-benefits">
                                    {plan.benefits.map((b, i) => (
                                        <li key={i}>
                                            <Check size={13} /> {b}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </button>
                    ))}
                </div>

                {shortfall !== null && (
                    <div className="subscribe-modal__topup">
                        <p>
                            You&apos;re {naira.format(shortfall)} short. Top up your wallet to subscribe.
                        </p>
                        <Link href="/fan/wallet" className="subscribe-modal__topup-btn">
                            <Wallet size={15} /> Top up wallet
                        </Link>
                    </div>
                )}

                {error && <p className="subscribe-modal__error">{error}</p>}

                <button
                    type="button"
                    className="subscribe-modal__cta"
                    onClick={handleSubscribe}
                    disabled={isPending || !selectedPlanId}
                >
                    {isPending ? <Loader2 size={16} className="subscribe-modal__spinner" /> : "Subscribe"}
                </button>
            </div>
        </div>
    )
}