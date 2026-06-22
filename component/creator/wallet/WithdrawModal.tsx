// components/creator/wallet/WithdrawModal.tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import { X, Loader2, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react"
import { getBankAccountsAction, withdrawAction } from "@/actions/creator/wallet"
import "@/styles/creator/wallet/WithdrawModal.scss"

type Account = Awaited<ReturnType<typeof getBankAccountsAction>>[0]

type Props = {
    balance:   number
    isVerified: boolean
    verificationStatus: string
    onClose:   () => void
    onSuccess: () => void
}

const PLATFORM_FEE = 10

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style:                 "currency",
        currency:              "NGN",
        maximumFractionDigits: 0,
    }).format(n)

export const WithdrawModal = ({ balance, isVerified, verificationStatus, onClose, onSuccess }: Props) => {

    const [accounts,   setAccounts]   = useState<Account[]>([])
    const [accountId,  setAccountId]  = useState("")
    const [amount,     setAmount]     = useState("")
    const [error,      setError]      = useState<string | null>(null)
    const [success,    setSuccess]    = useState(false)
    const [netAmount,  setNetAmount]  = useState(0)
    const [isPending,  startTransition] = useTransition()

    useEffect(() => {
        startTransition(async () => {
            const res = await getBankAccountsAction()
            setAccounts(res)
            const def = res.find((a) => a.isDefault)
            if (def) setAccountId(def.id)
        })
    }, [])

    const amountNum   = Number(amount)
    const fee         = Math.round(amountNum * PLATFORM_FEE / 100)
    const net         = amountNum - fee
    const isValid     = amountNum >= 1000 && amountNum <= balance && !!accountId && isVerified

// components/creator/wallet/WithdrawModal.tsx — update handleWithdraw

const handleWithdraw = () => {
    setError(null)
    startTransition(async () => {
        const res = await withdrawAction({
            amount:        amountNum,
            bankAccountId: accountId,
        })

        if (res?.error === "UNVERIFIED") {
            // Redirect to verification page
            window.location.href = "/creator/verification"
            return
        }

        if (res?.error) {
            setError(res.error)
            return
        }

        if (res?.success) {
            setNetAmount(res.netAmount ?? net)
            setSuccess(true)
            setTimeout(onSuccess, 2500)
        }
    })
}

    return (
        <div className="withdraw-overlay" onClick={onClose}>
            <div className="withdraw-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="withdraw-modal__header">
                    <h2>Withdraw Funds</h2>
                    <button className="withdraw-modal__close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {success ? (
                    <div className="withdraw-modal__success">
                        <CheckCircle size={40} />
                        <h3>Withdrawal submitted!</h3>
                        <p>
                            {fmtMoney(netAmount)} will be processed to your bank
                            account within 2–3 business days.
                        </p>
                    </div>
                ) : (
                    <div className="withdraw-modal__body">

                        {/* Balance */}
                        <div className="withdraw-modal__balance">
                            <span>Available balance</span>
                            <strong>{fmtMoney(balance)}</strong>
                        </div>

                        {/* Bank account */}
                        <div className="withdraw-form-field">
                            <label>Bank Account</label>
                            {accounts.length === 0 ? (
                                <p className="withdraw-form-field__empty">
                                    No bank accounts added. Add one from your wallet page.
                                </p>
                            ) : (
                                <select
                                    value={accountId}
                                    onChange={(e) => setAccountId(e.target.value)}
                                    disabled={isPending}
                                >
                                    <option value="">Select account</option>
                                    {accounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.bankName} · ••••{acc.accountNumber.slice(-4)} ({acc.accountName})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {/* Amount */}
                        <div className="withdraw-form-field">
                            <label>Amount (₦)</label>
                            <div className="withdraw-amount-wrap">
                                <span className="withdraw-amount-wrap__symbol">₦</span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    min={1000}
                                    max={balance}
                                    disabled={isPending}
                                />
                            </div>

                            {!isVerified && (
                                <div className="withdraw-modal__unverified">
                                    <ShieldAlert size={16} />
                                        <div>
                                            <p>Identity verification required</p>
                                            <span>
                                                You must be a verified creator to withdraw funds.
                                                {verificationStatus === "PENDING"
                                                    ? " Your verification is under review."
                                                    : " Complete your KYC to unlock withdrawals."
                                                }
                                            </span>
                                            <a href="/creator/verification" className="withdraw-modal__verify-link">
                                                {verificationStatus === "PENDING"
                                                    ? "Check verification status →"
                                                    : "Verify your identity →"
                                                }
                                            </a>
                                        </div>
                                </div>
                            )}
                            <div className="withdraw-form-field__hints">
                                <span>Min: ₦1,000</span>
                                <button
                                    type="button"
                                    className="withdraw-form-field__max"
                                    onClick={() => setAmount(String(Math.floor(balance)))}
                                >
                                    Max
                                </button>
                            </div>
                        </div>

                        {/* Fee breakdown */}
                        {amountNum >= 1000 && (
                            <div className="withdraw-breakdown">
                                <div className="withdraw-breakdown__row">
                                    <span>Withdrawal amount</span>
                                    <strong>{fmtMoney(amountNum)}</strong>
                                </div>
                                <div className="withdraw-breakdown__row withdraw-breakdown__row--fee">
                                    <span>Platform fee ({PLATFORM_FEE}%)</span>
                                    <strong>— {fmtMoney(fee)}</strong>
                                </div>
                                <div className="withdraw-breakdown__row withdraw-breakdown__row--net">
                                    <span>You receive</span>
                                    <strong>{fmtMoney(net)}</strong>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="withdraw-modal__error">
                                <AlertCircle size={15} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            className="withdraw-modal__submit"
                            onClick={handleWithdraw}
                            disabled={!isValid || isPending}
                        >
                            {isPending
                                ? <><Loader2 size={16} className="spin" /> Processing…</>
                                : `Withdraw ${amountNum >= 1000 ? fmtMoney(net) : ""}`
                            }
                        </button>

                    </div>
                )}
            </div>
        </div>
    )
}