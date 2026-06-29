// components/fan/wallet/WalletPageClient.tsx
"use client"

import { useState, useTransition, useCallback } from "react"
import {
    Wallet, Plus, ArrowDownLeft, ArrowUpRight,
    Loader2, Gift, CreditCard, RefreshCw, Repeat,
} from "lucide-react"
import {
    getFanTransactionHistoryAction,
    initializePaystackAction,
    verifyPaystackPaymentAction,
} from "@/actions/fan/wallet"
import "@/styles/fan/WalletPage.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type Transaction = {
    id:          string
    amount:      number
    type:        string
    description: string | null
    createdAt:   Date | string
}

type Filter = "all" | "incoming" | "outgoing"

type Props = {
    initialBalance:      number
    initialTransactions: Transaction[]
    initialPages:        number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRESETS = [500, 1000, 2000, 5000, 10000]

const TYPE_META: Record<string, { label: string; icon: React.ReactNode; credit: boolean }> = {
    DEPOSIT:              { label: "Wallet top-up",   icon: <CreditCard size={15} />, credit: true  },
    REFUND:              { label: "Refund",          icon: <RefreshCw  size={15} />, credit: true  },
    GIFT_PURCHASE:       { label: "Gift sent",       icon: <Gift       size={15} />, credit: false },
    SUBSCRIPTION_PAYMENT:{ label: "Subscription",    icon: <Repeat     size={15} />, credit: false },
}

function formatDate(date: Date | string) {
    return new Date(date).toLocaleDateString("en-NG", {
        day: "numeric", month: "short", year: "numeric",
    })
}

function formatTime(date: Date | string) {
    return new Date(date).toLocaleTimeString("en-NG", {
        hour: "2-digit", minute: "2-digit",
    })
}

// ── WalletPageClient ──────────────────────────────────────────────────────────

export const WalletPageClient = ({
    initialBalance,
    initialTransactions,
    initialPages,
}: Props) => {
    const [balance,      setBalance]      = useState(initialBalance)
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions)
    const [filter,       setFilter]       = useState<Filter>("all")
    const [page,         setPage]         = useState(1)
    const [pages,        setPages]        = useState(initialPages)
    const [loading,      setLoading]      = useState(false)

    const [showTopUp,    setShowTopUp]    = useState(false)
    const [topUpAmount,  setTopUpAmount]  = useState<number | null>(1000)
    const [toast,        setToast]        = useState<string | null>(null)
    const [isPending,    startTransition] = useTransition()

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(null), 3000)
    }

    // ── Filter switch ─────────────────────────────────────────────────────────
    const handleFilter = (f: Filter) => {
        setFilter(f)
        setPage(1)
        setLoading(true)
        startTransition(async () => {
            const data = await getFanTransactionHistoryAction({ page: 1, filter: f })
            setTransactions(data.transactions)
            setPages(data.pages)
            setLoading(false)
        })
    }

    // ── Load more ─────────────────────────────────────────────────────────────
    const loadMore = useCallback(async () => {
        if (loading || page >= pages) return
        setLoading(true)
        const nextPage = page + 1
        const data = await getFanTransactionHistoryAction({ page: nextPage, filter })
        setTransactions((prev) => [...prev, ...data.transactions])
        setPage(nextPage)
        setLoading(false)
    }, [loading, page, pages, filter])

    // ── Top-up ────────────────────────────────────────────────────────────────
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
                        // Refresh history
                        const fresh = await getFanTransactionHistoryAction({ page: 1, filter })
                        setTransactions(fresh.transactions)
                        setPages(fresh.pages)
                        setPage(1)
                        showToast(`₦${topUpAmount.toLocaleString()} added to your wallet!`)
                        setShowTopUp(false)
                    } else {
                        showToast("Payment verification failed. Contact support.")
                    }
                },
                onCancel: () => showToast("Payment cancelled."),
            })
        })
    }

    return (
        <div className="wallet-page">

            {/* Header */}
            <div className="wallet-page__header">
                <h1>My Wallet</h1>
            </div>

            {/* Balance card */}
            <div className="wallet-page__balance">
                <div className="wallet-page__balance-top">
                    <Wallet size={18} />
                    <span>Available Balance</span>
                </div>
                <span className="wallet-page__balance-amount">
                    ₦{balance.toLocaleString()}
                </span>
                <button
                    type="button"
                    className="wallet-page__topup-toggle"
                    onClick={() => setShowTopUp((v) => !v)}
                >
                    <Plus size={15} />
                    Top up wallet
                </button>
            </div>

            {/* Top-up section */}
            {showTopUp && (
                <div className="wallet-page__topup">
                    <p className="wallet-page__topup-label">Choose an amount</p>
                    <div className="wallet-page__presets">
                        {PRESETS.map((p) => (
                            <button
                                key={p}
                                type="button"
                                className={`wallet-page-preset ${topUpAmount === p ? "wallet-page-preset--active" : ""}`}
                                onClick={() => setTopUpAmount(p)}
                            >
                                ₦{p.toLocaleString()}
                            </button>
                        ))}
                    </div>
                    <div className="wallet-page__custom">
                        <span>₦</span>
                        <input
                            type="number"
                            placeholder="Custom amount"
                            value={topUpAmount ?? ""}
                            onChange={(e) => setTopUpAmount(Number(e.target.value))}
                            min={100}
                        />
                    </div>
                    <button
                        type="button"
                        className="wallet-page__pay-btn"
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

            {/* Transaction history */}
            <div className="wallet-page__history">
                <div className="wallet-page__history-header">
                    <h2>Transaction History</h2>
                </div>

                {/* Filter tabs */}
                <div className="wallet-page__tabs">
                    {(["all", "incoming", "outgoing"] as Filter[]).map((f) => (
                        <button
                            key={f}
                            type="button"
                            className={`wallet-tab ${filter === f ? "wallet-tab--active" : ""}`}
                            onClick={() => handleFilter(f)}
                        >
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Transaction list */}
                {loading && transactions.length === 0 ? (
                    <div className="wallet-page__loading">
                        <Loader2 size={22} className="spin" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="wallet-page__empty">
                        <p>No {filter !== "all" ? filter : ""} transactions yet.</p>
                    </div>
                ) : (
                    <div className="wallet-page__list">
                        {transactions.map((tx) => {
                            const meta = TYPE_META[tx.type] ?? { label: tx.type, icon: <Wallet size={15} />, credit: false }
                            return (
                                <div key={tx.id} className="wallet-row">
                                    <div className={`wallet-row__icon ${meta.credit ? "wallet-row__icon--credit" : "wallet-row__icon--debit"}`}>
                                        {meta.credit
                                            ? <ArrowDownLeft size={15} />
                                            : <ArrowUpRight  size={15} />
                                        }
                                    </div>
                                    <div className="wallet-row__info">
                                        <span className="wallet-row__label">{meta.label}</span>
                                        {tx.description && (
                                            <span className="wallet-row__desc">{tx.description}</span>
                                        )}
                                        <span className="wallet-row__date">
                                            {formatDate(tx.createdAt)} · {formatTime(tx.createdAt)}
                                        </span>
                                    </div>
                                    <span className={`wallet-row__amount ${meta.credit ? "wallet-row__amount--credit" : "wallet-row__amount--debit"}`}>
                                        {meta.credit ? "+" : "−"}₦{tx.amount.toLocaleString()}
                                    </span>
                                </div>
                            )
                        })}

                        {page < pages && (
                            <button
                                type="button"
                                className="wallet-page__load-more"
                                onClick={loadMore}
                                disabled={loading}
                            >
                                {loading
                                    ? <><Loader2 size={14} className="spin" /> Loading…</>
                                    : "Load more"
                                }
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && <div className="wallet-page__toast">{toast}</div>}

        </div>
    )
}