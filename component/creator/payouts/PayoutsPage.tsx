// components/creator/monetization/payouts/PayoutsPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import {
    ArrowDownToLine, Loader2, Clock,
    CheckCircle, XCircle, Building2,
} from "lucide-react"
import { getPayoutHistoryAction } from "@/actions/creator/wallet"
import { format }                 from "date-fns"
import "@/styles/creator/monetization/PayoutsPage.scss"

type Payout = Awaited<ReturnType<typeof getPayoutHistoryAction>>["payouts"][0]
type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "PAID" | "REJECTED"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "ALL",      label: "All"      },
    { value: "PENDING",  label: "Pending"  },
    { value: "APPROVED", label: "Approved" },
    { value: "PAID",     label: "Paid"     },
    { value: "REJECTED", label: "Rejected" },
]

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency", currency: "NGN", maximumFractionDigits: 0,
    }).format(n)

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    PENDING:  { label: "Pending",  color: "amber", icon: <Clock       size={12} /> },
    APPROVED: { label: "Approved", color: "blue",  icon: <CheckCircle size={12} /> },
    PAID:     { label: "Paid",     color: "green", icon: <CheckCircle size={12} /> },
    REJECTED: { label: "Rejected", color: "red",   icon: <XCircle     size={12} /> },
}

export const PayoutsPage = () => {

    const [payouts,    setPayouts]    = useState<Payout[]>([])
    const [total,      setTotal]      = useState(0)
    const [pages,      setPages]      = useState(1)
    const [page,       setPage]       = useState(1)
    const [status,     setStatus]     = useState<StatusFilter>("ALL")
    const [stats,      setStats]      = useState<{
        totalPaid: number
        totalPending: number
        totalFees: number
    } | null>(null)
    const [isPending,  startTransition] = useTransition()

    const fetchPayouts = useCallback(() => {
        startTransition(async () => {
            const res = await getPayoutHistoryAction({
                status: status === "ALL" ? undefined : status,
                page,
                limit: 20,
            })
            setPayouts(res.payouts)
            setTotal(res.total)
            setPages(res.pages)
            setStats(res.stats)
        })
    }, [status, page])

    useEffect(() => { fetchPayouts() }, [fetchPayouts])

    return (
        <div className="payouts-page">

            {/* ── Stats ── */}
            {stats && (
                <div className="payouts-stats">
                    <div className="payout-stat">
                        <div className="payout-stat__icon payout-stat__icon--green">
                            <CheckCircle size={18} />
                        </div>
                        <div>
                            <p className="payout-stat__value">{fmtMoney(stats.totalPaid)}</p>
                            <p className="payout-stat__label">Total Paid Out</p>
                        </div>
                    </div>
                    <div className="payout-stat">
                        <div className="payout-stat__icon payout-stat__icon--amber">
                            <Clock size={18} />
                        </div>
                        <div>
                            <p className="payout-stat__value">{fmtMoney(stats.totalPending)}</p>
                            <p className="payout-stat__label">Pending Approval</p>
                        </div>
                    </div>
                    <div className="payout-stat">
                        <div className="payout-stat__icon payout-stat__icon--primary">
                            <ArrowDownToLine size={18} />
                        </div>
                        <div>
                            <p className="payout-stat__value">{fmtMoney(stats.totalFees)}</p>
                            <p className="payout-stat__label">Platform Fees Paid</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="payouts-page__header">
                <div className="payouts-page__title">
                    <ArrowDownToLine size={20} />
                    <div>
                        <h2>Payout History</h2>
                        <p>
                            {total === 0
                                ? "No withdrawals yet"
                                : `${total.toLocaleString()} withdrawal${total !== 1 ? "s" : ""}`
                            }
                        </p>
                    </div>
                </div>

                <div className="payout-filter-group">
                    {STATUS_FILTERS.map((f) => (
                        <button
                            key={f.value}
                            className={`payout-filter-btn ${status === f.value ? "payout-filter-btn--active" : ""}`}
                            onClick={() => { setStatus(f.value); setPage(1) }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── List ── */}
            {isPending ? (
                <div className="payouts-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : payouts.length === 0 ? (
                <div className="payouts-page__empty">
                    <ArrowDownToLine size={32} />
                    <h3>
                        {status !== "ALL"
                            ? `No ${status.toLowerCase()} withdrawals`
                            : "No withdrawals yet"
                        }
                    </h3>
                    <p>
                        {status === "ALL"
                            ? "Your withdrawal history will appear here once you request a payout."
                            : "Try a different filter."
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="payouts-list">
                        {payouts.map((p) => {
                            const config = statusConfig[p.status] ?? statusConfig.PENDING
                            return (
                                <div key={p.id} className={`payout-item payout-item--${config.color}`}>
                                    <div className="payout-item__icon">
                                        <Building2 size={18} />
                                    </div>

                                    <div className="payout-item__info">
                                        <div className="payout-item__top">
                                            <p className="payout-item__bank">
                                                {p.bankAccount?.bankName ?? "Bank"}
                                                {p.bankAccount?.accountNumber && (
                                                    <span> · ••••{p.bankAccount.accountNumber.slice(-4)}</span>
                                                )}
                                            </p>
                                            <span className={`payout-status payout-status--${config.color}`}>
                                                {config.icon}
                                                {config.label}
                                            </span>
                                        </div>
                                        <p className="payout-item__date">
                                            Requested {format(new Date(p.createdAt), "d MMM yyyy · h:mm a")}
                                        </p>
                                        {p.notes && p.status === "REJECTED" && (
                                            <p className="payout-item__notes">
                                                Reason: {p.notes}
                                            </p>
                                        )}
                                    </div>

                                    <div className="payout-item__amounts">
                                        <p className="payout-item__net">{fmtMoney(Number(p.netAmount))}</p>
                                        <p className="payout-item__breakdown">
                                            {fmtMoney(Number(p.grossAmount))} − {fmtMoney(Number(p.platformFee))} fee
                                        </p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {pages > 1 && (
                        <div className="payouts-page__pagination">
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page === 1 || isPending}
                            >
                                Previous
                            </button>
                            <span className="page-indicator">
                                Page {page} of {pages}
                            </span>
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page === pages || isPending}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

        </div>
    )
}