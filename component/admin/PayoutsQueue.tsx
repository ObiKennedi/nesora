// component/admin/PayoutsQueue.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { approveWithdrawalAction, rejectWithdrawalAction } from "@/actions/admin/withdrawals"
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react"

const TABS = [
    { value: "PENDING",    label: "Pending" },
    { value: "PROCESSING", label: "Processing" },
    { value: "PAID",       label: "Paid" },
    { value: "REJECTED",   label: "Rejected" },
    { value: "FAILED",     label: "Failed" },
] as const

type Withdrawal = {
    id:            string
    grossAmount:   string | number
    platformFee:   string | number
    netAmount:     string | number
    status:        string
    createdAt:     string
    failureReason: string | null
    reviewNotes:   string | null
    bankAccount: {
        bankName:      string
        accountName:   string
        accountNumber: string
    } | null
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        isVerified:  boolean
        trustScore:  number
        user:   { id: string; email: string; image: string | null }
        wallet: { balance: string | number } | null
    }
}

type Props = {
    withdrawals:  Withdrawal[]
    activeStatus: string
    page:         number
    pages:        number
}

const naira = (v: string | number) => `₦${Number(v).toLocaleString()}`

export function PayoutsQueue({ withdrawals, activeStatus, page, pages }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [busyId, setBusyId]         = useState<string | null>(null)
    const [rejecting, setRejecting]   = useState<Withdrawal | null>(null)
    const [rejectReason, setReason]   = useState("")
    const [error, setError]           = useState<string | null>(null)

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set(key, value)
        if (key === "status") params.delete("page")
        router.push(`/admin/payouts?${params.toString()}`)
    }

    const handleApprove = (w: Withdrawal) => {
        if (!confirm(`Approve payout of ${naira(w.netAmount)} to ${w.creator.displayName}? This initiates a real bank transfer.`)) return

        setBusyId(w.id)
        setError(null)
        startTransition(async () => {
            const res = await approveWithdrawalAction(w.id)
            if ("error" in res && res.error) setError(res.error)
            else router.refresh()
            setBusyId(null)
        })
    }

    const handleReject = () => {
        if (!rejecting) return

        setBusyId(rejecting.id)
        setError(null)
        startTransition(async () => {
            const res = await rejectWithdrawalAction({
                withdrawalId: rejecting.id,
                reason:       rejectReason,
            })
            if ("error" in res && res.error) {
                setError(res.error)
            } else {
                setRejecting(null)
                setReason("")
                router.refresh()
            }
            setBusyId(null)
        })
    }

    return (
        <div className="payouts-queue">
            {/* ── Status tabs ── */}
            <div className="payouts-queue__tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        className={`payouts-queue__tab${
                            activeStatus === tab.value ? " payouts-queue__tab--active" : ""
                        }`}
                        onClick={() => setParam("status", tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {error && <p className="payouts-queue__error">{error}</p>}

            {/* ── Table ── */}
            {withdrawals.length === 0 ? (
                <div className="payouts-queue__empty">
                    Nothing here — no {activeStatus.toLowerCase()} withdrawals.
                </div>
            ) : (
                <div className="payouts-queue__table-wrap">
                    <table className="payouts-queue__table">
                        <thead>
                            <tr>
                                <th>Creator</th>
                                <th>Bank details</th>
                                <th>Gross</th>
                                <th>Fee (10%)</th>
                                <th>Net payout</th>
                                <th>Requested</th>
                                {activeStatus === "PENDING" && <th>Actions</th>}
                                {(activeStatus === "REJECTED" || activeStatus === "FAILED") && <th>Reason</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {withdrawals.map((w) => (
                                <tr key={w.id}>
                                    <td>
                                        <div className="payouts-queue__creator">
                                            {w.creator.user.image ? (
                                                <Image
                                                    src={w.creator.user.image}
                                                    alt={w.creator.displayName}
                                                    width={32}
                                                    height={32}
                                                    className="payouts-queue__avatar"
                                                />
                                            ) : (
                                                <span className="payouts-queue__avatar payouts-queue__avatar--fallback">
                                                    {w.creator.displayName.charAt(0)}
                                                </span>
                                            )}
                                            <div>
                                                <span className="payouts-queue__creator-name">
                                                    {w.creator.displayName}
                                                    {w.creator.isVerified && (
                                                        <ShieldCheck size={14} className="payouts-queue__verified" />
                                                    )}
                                                </span>
                                                <span className="payouts-queue__creator-meta">
                                                    @{w.creator.handle ?? "—"} · {w.creator.user.email}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {w.bankAccount ? (
                                            <div className="payouts-queue__bank">
                                                <span>{w.bankAccount.bankName}</span>
                                                <span className="payouts-queue__bank-meta">
                                                    {w.bankAccount.accountNumber} · {w.bankAccount.accountName}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="payouts-queue__bank-missing">No account</span>
                                        )}
                                    </td>
                                    <td>{naira(w.grossAmount)}</td>
                                    <td className="payouts-queue__fee">{naira(w.platformFee)}</td>
                                    <td className="payouts-queue__net">{naira(w.netAmount)}</td>
                                    <td className="payouts-queue__date">
                                        {new Date(w.createdAt).toLocaleDateString("en-NG", {
                                            day: "numeric", month: "short", year: "numeric",
                                        })}
                                    </td>

                                    {activeStatus === "PENDING" && (
                                        <td>
                                            <div className="payouts-queue__actions">
                                                <button
                                                    type="button"
                                                    className="payouts-queue__btn payouts-queue__btn--approve"
                                                    disabled={isPending && busyId === w.id}
                                                    onClick={() => handleApprove(w)}
                                                >
                                                    {busyId === w.id ? (
                                                        <Loader2 size={14} className="payouts-queue__spinner" />
                                                    ) : (
                                                        <CheckCircle2 size={14} />
                                                    )}
                                                    Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    className="payouts-queue__btn payouts-queue__btn--reject"
                                                    disabled={isPending && busyId === w.id}
                                                    onClick={() => { setRejecting(w); setError(null) }}
                                                >
                                                    <XCircle size={14} />
                                                    Reject
                                                </button>
                                            </div>
                                        </td>
                                    )}

                                    {(activeStatus === "REJECTED" || activeStatus === "FAILED") && (
                                        <td className="payouts-queue__reason">
                                            {w.reviewNotes ?? w.failureReason ?? "—"}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {pages > 1 && (
                <div className="payouts-queue__pagination">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setParam("page", String(page - 1))}
                    >
                        Previous
                    </button>
                    <span>Page {page} of {pages}</span>
                    <button
                        type="button"
                        disabled={page >= pages}
                        onClick={() => setParam("page", String(page + 1))}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* ── Reject modal ── */}
            {rejecting && (
                <div className="payouts-queue__overlay" onClick={() => setRejecting(null)}>
                    <div className="payouts-queue__modal" onClick={(e) => e.stopPropagation()}>
                        <h2 className="payouts-queue__modal-title">Reject withdrawal</h2>
                        <p className="payouts-queue__modal-body">
                            {naira(rejecting.netAmount)} to <strong>{rejecting.creator.displayName}</strong> will
                            be rejected and <strong>{naira(rejecting.grossAmount)}</strong> refunded to their wallet.
                        </p>
                        <textarea
                            className="payouts-queue__modal-input"
                            placeholder="Reason (shown to the creator)…"
                            value={rejectReason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                        <div className="payouts-queue__modal-actions">
                            <button
                                type="button"
                                className="payouts-queue__btn"
                                onClick={() => { setRejecting(null); setReason("") }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="payouts-queue__btn payouts-queue__btn--reject"
                                disabled={rejectReason.trim().length < 3 || isPending}
                                onClick={handleReject}
                            >
                                {isPending && busyId === rejecting.id ? (
                                    <Loader2 size={14} className="payouts-queue__spinner" />
                                ) : (
                                    <XCircle size={14} />
                                )}
                                Confirm rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}