// components/creator/settings/DangerZone.tsx
"use client"

import { useState, useTransition } from "react"
import { Trash2, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react"
import { deleteAccountAction }     from "@/actions/creator/settings"

type Props = {
    data: {
        hasPassword:     boolean
        isGoogleAccount: boolean
        user?:           { email?: string | null } | null
    }
}

export const DangerZone = ({ data }: Props) => {

    const [showConfirm, setShowConfirm] = useState(false)
    const [password,    setPassword]    = useState("")
    const [confirmEmail, setConfirmEmail] = useState("")
    const [showPw,      setShowPw]      = useState(false)
    const [typed,       setTyped]       = useState("")
    const [error,       setError]       = useState<string | null>(null)
    const [isPending,   startTransition] = useTransition()

    const CONFIRM_PHRASE = "delete my account"
    const canDelete = typed === CONFIRM_PHRASE && (data.hasPassword ? !!password : !!confirmEmail)

    const handleDelete = () => {
        setError(null)
        startTransition(async () => {
            const res = await deleteAccountAction(password, confirmEmail || undefined)
            if ((res as any)?.error) setError((res as any).error)
        })
    }

    return (
        <div className="settings-panel">
            <div className="settings-panel__header settings-panel__header--danger">
                <h2>Danger Zone</h2>
                <p>These actions are irreversible. Please read carefully before proceeding.</p>
            </div>

            <div className="settings-panel__body">

                <div className="danger-item">
                    <div className="danger-item__info">
                        <p className="danger-item__title">
                            <AlertTriangle size={15} />
                            Delete Account
                        </p>
                        <p className="danger-item__desc">
                            Permanently delete your account and all associated data — posts,
                            followers, subscribers, earnings history, and messages.
                            This cannot be undone.
                        </p>
                    </div>

                    {!showConfirm ? (
                        <button
                            className="danger-btn"
                            onClick={() => setShowConfirm(true)}
                        >
                            <Trash2 size={14} />
                            Delete Account
                        </button>
                    ) : (
                        <div className="danger-confirm">
                            <div className="settings-notice settings-notice--danger">
                                <strong>This will permanently delete your account.</strong>
                                All your content, followers, subscribers, and earnings data will be
                                removed. This action is not reversible.
                            </div>

                            {data.hasPassword ? (
                                <div className="settings-field">
                                    <label>Enter your password to confirm</label>
                                    <div className="settings-field__pw-wrap">
                                        <input
                                            type={showPw ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Your current password"
                                            disabled={isPending}
                                        />
                                        <button
                                            type="button"
                                            className="settings-field__toggle"
                                            onClick={() => setShowPw((v) => !v)}
                                            tabIndex={-1}
                                        >
                                            {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="settings-field">
                                    <label>Enter your email address ({data.user?.email}) to confirm</label>
                                    <input
                                        type="email"
                                        value={confirmEmail}
                                        onChange={(e) => setConfirmEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        disabled={isPending}
                                    />
                                </div>
                            )}

                            <div className="settings-field">
                                <label>
                                    Type <strong>"{CONFIRM_PHRASE}"</strong> to confirm
                                </label>
                                <input
                                    type="text"
                                    value={typed}
                                    onChange={(e) => setTyped(e.target.value)}
                                    placeholder={CONFIRM_PHRASE}
                                    disabled={isPending}
                                />
                            </div>

                            {error && <p className="settings-error">{error}</p>}

                            <div className="danger-confirm__actions">
                                <button
                                    className="danger-confirm__cancel"
                                    onClick={() => {
                                        setShowConfirm(false)
                                        setPassword("")
                                        setConfirmEmail("")
                                        setTyped("")
                                        setError(null)
                                    }}
                                    disabled={isPending}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="danger-confirm__delete"
                                    onClick={handleDelete}
                                    disabled={!canDelete || isPending}
                                >
                                    {isPending
                                        ? <><Loader2 size={14} className="spin" /> Deleting…</>
                                        : <><Trash2  size={14} /> Permanently Delete</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}