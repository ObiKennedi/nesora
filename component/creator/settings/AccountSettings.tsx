// components/creator/settings/AccountSettings.tsx
"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle }    from "lucide-react"
import { updateAccountAction }     from "@/actions/creator/settings"

type Props = {
    data: {
        user: {
            firstName: string | null
            lastName:  string | null
            email:     string | null
            username:  string | null
            emailVerified: Date | null
        } | null
        isGoogleAccount: boolean
    }
    onSuccess: () => void
}

export const AccountSettings = ({ data, onSuccess }: Props) => {

    const [firstName, setFirstName] = useState(data.user?.firstName ?? "")
    const [lastName,  setLastName]  = useState(data.user?.lastName  ?? "")
    const [email,     setEmail]     = useState(data.user?.email     ?? "")
    const [saved,     setSaved]     = useState(false)
    const [error,     setError]     = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await updateAccountAction({ firstName, lastName, email })
            if (res?.error) {
                setError(res.error)
            } else {
                setSaved(true)
                onSuccess()
                setTimeout(() => setSaved(false), 2000)
            }
        })
    }

    return (
        <div className="settings-panel">
            <div className="settings-panel__header">
                <h2>Account Settings</h2>
                <p>Manage your personal information and email address.</p>
            </div>

            <div className="settings-panel__body">

                {data.isGoogleAccount && (
                    <div className="settings-notice settings-notice--info">
                        Signed in with Google. Email changes may not affect your Google login.
                    </div>
                )}

                <div className="settings-form-row">
                    <div className="settings-field">
                        <label>First Name</label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="settings-field">
                        <label>Last Name</label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isPending}
                        />
                    </div>
                </div>

                <div className="settings-field">
                    <label>
                        Email Address
                        {data.user?.emailVerified && (
                            <span className="settings-field__verified">
                                <CheckCircle size={12} /> Verified
                            </span>
                        )}
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isPending}
                    />
                </div>

                <div className="settings-field">
                    <label>Username</label>
                    <input
                        type="text"
                        value={data.user?.username ?? ""}
                        disabled
                        className="settings-field__disabled"
                    />
                    <p className="settings-field__hint">
                        Change your username from the{" "}
                        <a href="/creator/profile">Profile page</a>.
                    </p>
                </div>

                {error && <p className="settings-error">{error}</p>}

                <button
                    className="settings-save-btn"
                    onClick={handleSave}
                    disabled={isPending || !firstName || !lastName || !email}
                >
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle size={14} /> Saved!</>
                        : "Save Changes"
                    }
                </button>

            </div>
        </div>
    )
}