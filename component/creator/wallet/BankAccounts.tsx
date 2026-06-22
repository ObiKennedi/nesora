// components/creator/wallet/BankAccounts.tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import {
    Plus, Star, Trash2, Loader2,
    Building2, CheckCircle,
} from "lucide-react"
import {
    getBankAccountsAction,
    addBankAccountAction,
    setDefaultBankAccountAction,
    deleteBankAccountAction,
} from "@/actions/creator/wallet"
import "@/styles/creator/wallet/BankAccounts.scss"

type Account = Awaited<ReturnType<typeof getBankAccountsAction>>[0]

// Nigerian banks
const NIGERIAN_BANKS = [
    { name: "Access Bank",        code: "044" },
    { name: "Citibank",           code: "023" },
    { name: "Ecobank",            code: "050" },
    { name: "Fidelity Bank",      code: "070" },
    { name: "First Bank",         code: "011" },
    { name: "First City Monument Bank", code: "214" },
    { name: "Guaranty Trust Bank", code: "058" },
    { name: "Heritage Bank",      code: "030" },
    { name: "Keystone Bank",      code: "082" },
    { name: "Opay",               code: "999992" },
    { name: "Palmpay",            code: "999991" },
    { name: "Polaris Bank",       code: "076" },
    { name: "Providus Bank",      code: "101" },
    { name: "Stanbic IBTC",       code: "221" },
    { name: "Standard Chartered", code: "068" },
    { name: "Sterling Bank",      code: "232" },
    { name: "Union Bank",         code: "032" },
    { name: "United Bank for Africa", code: "033" },
    { name: "Unity Bank",         code: "215" },
    { name: "Wema Bank",          code: "035" },
    { name: "Zenith Bank",        code: "057" },
]

type Props = { onWithdraw: () => void }

export const BankAccounts = ({ onWithdraw }: Props) => {

    const [accounts,    setAccounts]    = useState<Account[]>([])
    const [showForm,    setShowForm]    = useState(false)
    const [formData,    setFormData]    = useState({
        bankName: "", accountName: "", accountNumber: "", bankCode: "",
    })
    const [error,       setError]       = useState<string | null>(null)
    const [isPending,   startTransition] = useTransition()
    const [acting,      setActing]      = useState<string | null>(null)

    useEffect(() => {
        startTransition(async () => {
            const res = await getBankAccountsAction()
            setAccounts(res)
        })
    }, [])

    const handleBankSelect = (code: string) => {
        const bank = NIGERIAN_BANKS.find((b) => b.code === code)
        setFormData((prev) => ({
            ...prev,
            bankCode: code,
            bankName: bank?.name ?? "",
        }))
    }

    const handleAdd = () => {
        setError(null)
        startTransition(async () => {
            const res = await addBankAccountAction(formData)
            if (res?.error) {
                setError(res.error)
            } else {
                const updated = await getBankAccountsAction()
                setAccounts(updated)
                setShowForm(false)
                setFormData({ bankName: "", accountName: "", accountNumber: "", bankCode: "" })
            }
        })
    }

    const handleSetDefault = (id: string) => {
        setActing(id)
        startTransition(async () => {
            await setDefaultBankAccountAction(id)
            const updated = await getBankAccountsAction()
            setAccounts(updated)
            setActing(null)
        })
    }

    const handleDelete = (id: string) => {
        if (!confirm("Remove this bank account?")) return
        setActing(id)
        startTransition(async () => {
            const res = await deleteBankAccountAction(id)
            if (res?.error) setError(res.error)
            else setAccounts((prev) => prev.filter((a) => a.id !== id))
            setActing(null)
        })
    }

    return (
        <div className="bank-accounts">
            <div className="bank-accounts__header">
                <h3 className="wallet-section-title">Bank Accounts</h3>
                {accounts.length < 3 && (
                    <button
                        className="bank-accounts__add-btn"
                        onClick={() => setShowForm((v) => !v)}
                    >
                        <Plus size={14} />
                        Add
                    </button>
                )}
            </div>

            {/* Add form */}
            {showForm && (
                <div className="bank-form">
                    <div className="bank-form__field">
                        <label>Bank</label>
                        <select
                            value={formData.bankCode}
                            onChange={(e) => handleBankSelect(e.target.value)}
                            disabled={isPending}
                        >
                            <option value="">Select bank</option>
                            {NIGERIAN_BANKS.map((b) => (
                                <option key={b.code} value={b.code}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bank-form__field">
                        <label>Account Number</label>
                        <input
                            type="text"
                            placeholder="0123456789"
                            maxLength={10}
                            value={formData.accountNumber}
                            onChange={(e) => setFormData((p) => ({
                                ...p, accountNumber: e.target.value.replace(/\D/g, "")
                            }))}
                            disabled={isPending}
                        />
                    </div>

                    <div className="bank-form__field">
                        <label>Account Name</label>
                        <input
                            type="text"
                            placeholder="As on your bank statement"
                            value={formData.accountName}
                            onChange={(e) => setFormData((p) => ({ ...p, accountName: e.target.value }))}
                            disabled={isPending}
                        />
                    </div>

                    {error && <p className="bank-form__error">{error}</p>}

                    <div className="bank-form__actions">
                        <button
                            className="bank-form__cancel"
                            onClick={() => { setShowForm(false); setError(null) }}
                            disabled={isPending}
                        >
                            Cancel
                        </button>
                        <button
                            className="bank-form__submit"
                            onClick={handleAdd}
                            disabled={isPending || !formData.bankCode || !formData.accountNumber || !formData.accountName}
                        >
                            {isPending ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />}
                            Save Account
                        </button>
                    </div>
                </div>
            )}

            {/* Account list */}
            {accounts.length === 0 && !showForm ? (
                <div className="bank-accounts__empty">
                    <Building2 size={24} />
                    <p>No bank accounts yet</p>
                    <span>Add an account to withdraw earnings</span>
                </div>
            ) : (
                <div className="bank-accounts__list">
                    {accounts.map((acc) => (
                        <div key={acc.id} className={`bank-account-item ${acc.isDefault ? "bank-account-item--default" : ""}`}>
                            <div className="bank-account-item__info">
                                <div className="bank-account-item__top">
                                    <p className="bank-account-item__bank">{acc.bankName}</p>
                                    {acc.isDefault && (
                                        <span className="bank-account-item__default-badge">
                                            <Star size={10} /> Default
                                        </span>
                                    )}
                                </div>
                                <p className="bank-account-item__name">{acc.accountName}</p>
                                <p className="bank-account-item__number">
                                    •••• •••• {acc.accountNumber.slice(-4)}
                                </p>
                            </div>
                            <div className="bank-account-item__actions">
                                {!acc.isDefault && (
                                    <button
                                        className="bank-account-item__btn"
                                        onClick={() => handleSetDefault(acc.id)}
                                        disabled={acting === acc.id}
                                        title="Set as default"
                                    >
                                        {acting === acc.id
                                            ? <Loader2 size={13} className="spin" />
                                            : <Star    size={13} />
                                        }
                                    </button>
                                )}
                                <button
                                    className="bank-account-item__btn bank-account-item__btn--delete"
                                    onClick={() => handleDelete(acc.id)}
                                    disabled={acting === acc.id}
                                    title="Remove account"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Withdraw button */}
            {accounts.length > 0 && (
                <button className="bank-accounts__withdraw-btn" onClick={onWithdraw}>
                    Withdraw Funds
                </button>
            )}
        </div>
    )
}