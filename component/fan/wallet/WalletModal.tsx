// components/fan/wallet/WalletModal.tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import { X, Wallet, ArrowUpRight, ArrowDownLeft, Loader2, Plus } from "lucide-react"
import Link                                                        from "next/link"
import {
    getFanWalletAction,
    initializePaystackAction,
    verifyPaystackPaymentAction,
} from "@/actions/fan/wallet"
import "@/styles/fan/WalletModal.scss"

type Transaction = {
    id:          string
    amount:      number
    type:        string
    description: string | null
    createdAt:   Date | string
}

type Props = {
    onClose: () => void
}

const PRESETS = [500, 1000, 2000, 5000, 10000]

const TYPE_LABELS: Record<string, string> = {
    DEPOSIT:              "Top-up",
    GIFT_PURCHASE:        "Gift sent",
    SUBSCRIPTION_PAYMENT: "Subscription",
    REFUND:               "Refund",
}

function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-NG", {
        day:   "numeric",
        month: "short",
        year:  "numeric",
    })
}

export const WalletModal = ({ onClose }: Props) => {
    const [balance,      setBalance]      = useState(0)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading,      setLoading]      = useState(true)
    const [topUpAmount,  setTopUpAmount]  = useState<number | null>(1000)
    const [showTopUp,    setShowTopUp]    = useState(false)
    const [visible,      setVisible]      = useState(false)
    const [toast,        setToast]        = useState<string | null>(null)
    const [isPending,    startTransition] = useTransition()

    // Slide-up animation
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10)
        return () => clearTimeout(t)
    }, [])

    // Load wallet data
    useEffect(() => {
        startTransition(async () => {
            const data = await getFanWalletAction()
            setBalance(data.balance)
            setTransactions(data.transactions)
            setLoading(false)
        })
    }, [])

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    const handleClose = () => {
        setVisible(false)
        setTimeout(onClose, 280)
    }

    // ── Paystack top-up ───────────────────────────────────────────────────────
    const handleTopUp = () => {
        if (!topUpAmount || topUpAmount < 100) return

        startTransition(async () => {
            const res = await initializePaystackAction(topUpAmount)
            if (res?.error) { showToast(res.error); return }
            if (!res?.success || !res.accessCode) return

            const PaystackPop = (await import("@paystack/inline-js")).default
            const handler     = new PaystackPop()

            handler.resumeTransaction(res.accessCode, {
                onSuccess: async (transaction: { reference: string }) => {
                    const verify = await verifyPaystackPaymentAction(transaction.reference)
                    if (verify?.success) {
                        setBalance((b) => b + topUpAmount)
                        // Refresh transactions
                        const fresh = await getFanWalletAction()
                        setTransactions(fresh.transactions)
                        showToast(`₦${topUpAmount.toLocaleString()} added to your wallet!`)
                        setShowTopUp(false)
                    } else {
                        showToast("Payment verification failed. Contact support.")
                    }
                },
                onCancel: () => {
                    showToast("Payment cancelled.")
                },
            })
        })
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className={`wallet-backdrop ${visible ? "wallet-backdrop--visible" : ""}`}
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                className={`wallet-modal ${visible ? "wallet-modal--visible" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label="Your wallet"
            >
                <div className="wallet-modal__handle" />

                {/* Header */}
                <div className="wallet-modal__header">
                    <div className="wallet-modal__header-left">
                        <Wallet size={18} className="wallet-modal__icon" />
                        <h3>My Wallet</h3>
                    </div>
                    <button
                        type="button"
                        className="wallet-modal__close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="wallet-modal__loading">
                        <Loader2 size={24} className="spin" />
                    </div>
                ) : (
                    <div className="wallet-modal__body">

                        {/* Balance card */}
                        <div className="wallet-balance-card">
                            <span className="wallet-balance-card__label">Available Balance</span>
                            <span className="wallet-balance-card__amount">
                                ₦{balance.toLocaleString()}
                            </span>
                            <button
                                type="button"
                                className="wallet-balance-card__topup"
                                onClick={() => setShowTopUp((v) => !v)}
                            >
                                <Plus size={14} />
                                Top up wallet
                            </button>
                        </div>

                        {/* Top-up section */}
                        {showTopUp && (
                            <div className="wallet-topup">
                                <p className="wallet-topup__label">Choose amount</p>
                                <div className="wallet-topup__presets">
                                    {PRESETS.map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            className={`wallet-preset ${topUpAmount === preset ? "wallet-preset--active" : ""}`}
                                            onClick={() => setTopUpAmount(preset)}
                                        >
                                            ₦{preset.toLocaleString()}
                                        </button>
                                    ))}
                                </div>

                                <div className="wallet-topup__custom">
                                    <span className="wallet-topup__currency">₦</span>
                                    <input
                                        type="number"
                                        className="wallet-topup__input"
                                        placeholder="Custom amount"
                                        value={topUpAmount ?? ""}
                                        onChange={(e) => setTopUpAmount(Number(e.target.value))}
                                        min={100}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="wallet-topup__pay-btn"
                                    onClick={handleTopUp}
                                    disabled={isPending || !topUpAmount || topUpAmount < 100}
                                >
                                    {isPending
                                        ? <><Loader2 size={15} className="spin" /> Processing…</>
                                        : `Pay ₦${(topUpAmount ?? 0).toLocaleString()} via Paystack`
                                    }
                                </button>
                            </div>
                        )}

                        {/* Recent transactions */}
                        <div className="wallet-transactions">
                            <div className="wallet-transactions__header">
                                <span>Recent Transactions</span>
                                <Link href="/fan/wallet" className="wallet-transactions__see-more" onClick={handleClose}>
                                    See all →
                                </Link>
                            </div>

                            {transactions.length === 0 ? (
                                <p className="wallet-transactions__empty">No transactions yet</p>
                            ) : (
                                <div className="wallet-transactions__list">
                                    {transactions.map((tx) => {
                                        const isCredit = tx.type === "DEPOSIT" || tx.type === "REFUND"
                                        return (
                                            <div key={tx.id} className="wallet-tx">
                                                <div className={`wallet-tx__icon ${isCredit ? "wallet-tx__icon--credit" : "wallet-tx__icon--debit"}`}>
                                                    {isCredit
                                                        ? <ArrowDownLeft size={14} />
                                                        : <ArrowUpRight  size={14} />
                                                    }
                                                </div>
                                                <div className="wallet-tx__info">
                                                    <span className="wallet-tx__label">
                                                        {TYPE_LABELS[tx.type] ?? tx.type}
                                                    </span>
                                                    {tx.description && (
                                                        <span className="wallet-tx__desc">{tx.description}</span>
                                                    )}
                                                    <span className="wallet-tx__date">{formatDate(tx.createdAt)}</span>
                                                </div>
                                                <span className={`wallet-tx__amount ${isCredit ? "wallet-tx__amount--credit" : "wallet-tx__amount--debit"}`}>
                                                    {isCredit ? "+" : "−"}₦{tx.amount.toLocaleString()}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                    </div>
                )}

                {/* Toast */}
                {toast && (
                    <div className="wallet-toast">{toast}</div>
                )}
            </div>
        </>
    )
}