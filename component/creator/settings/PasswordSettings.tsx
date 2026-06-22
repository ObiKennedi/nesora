// components/creator/settings/PasswordSettings.tsx
"use client"

import { useState, useTransition } from "react"
import { Eye, EyeOff, Loader2, CheckCircle } from "lucide-react"
import { changePasswordAction }    from "@/actions/creator/settings"

const getStrength = (pw: string) => {
    let s = 0
    if (pw.length >= 8)              s++
    if (/[A-Z]/.test(pw))            s++
    if (/[0-9]/.test(pw))            s++
    if (/[^a-zA-Z0-9]/.test(pw))    s++
    return s
}
const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"]
const strengthClass = ["", "weak", "fair", "good", "strong"]

export const PasswordSettings = () => {

    const [current,    setCurrent]    = useState("")
    const [newPw,      setNewPw]      = useState("")
    const [confirm,    setConfirm]    = useState("")
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew,    setShowNew]    = useState(false)
    const [saved,      setSaved]      = useState(false)
    const [error,      setError]      = useState<string | null>(null)
    const [isPending,  startTransition] = useTransition()

    const strength = getStrength(newPw)

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await changePasswordAction({
                currentPassword: current,
                newPassword:     newPw,
                confirmPassword: confirm,
            })
            if (res?.error) {
                setError(res.error)
            } else {
                setSaved(true)
                setCurrent(""); setNewPw(""); setConfirm("")
                setTimeout(() => setSaved(false), 2000)
            }
        })
    }

    return (
        <div className="settings-panel">
            <div className="settings-panel__header">
                <h2>Change Password</h2>
                <p>Update your password regularly to keep your account secure.</p>
            </div>

            <div className="settings-panel__body">

                {/* Current */}
                <div className="settings-field">
                    <label>Current Password</label>
                    <div className="settings-field__pw-wrap">
                        <input
                            type={showCurrent ? "text" : "password"}
                            value={current}
                            onChange={(e) => setCurrent(e.target.value)}
                            placeholder="Enter current password"
                            disabled={isPending}
                        />
                        <button
                            type="button"
                            className="settings-field__toggle"
                            onClick={() => setShowCurrent((v) => !v)}
                            tabIndex={-1}
                        >
                            {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                </div>

                {/* New */}
                <div className="settings-field">
                    <label>New Password</label>
                    <div className="settings-field__pw-wrap">
                        <input
                            type={showNew ? "text" : "password"}
                            value={newPw}
                            onChange={(e) => setNewPw(e.target.value)}
                            placeholder="Create a strong password"
                            disabled={isPending}
                        />
                        <button
                            type="button"
                            className="settings-field__toggle"
                            onClick={() => setShowNew((v) => !v)}
                            tabIndex={-1}
                        >
                            {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                    </div>
                    {newPw.length > 0 && (
                        <div className="settings-strength">
                            <div className="settings-strength__bars">
                                {[1,2,3,4].map((i) => (
                                    <div
                                        key={i}
                                        className={`settings-strength__bar ${i <= strength ? `settings-strength__bar--${strengthClass[strength]}` : ""}`}
                                    />
                                ))}
                            </div>
                            <span className={`settings-strength__label settings-strength__label--${strengthClass[strength]}`}>
                                {strengthLabel[strength]}
                            </span>
                        </div>
                    )}
                </div>

                {/* Confirm */}
                <div className="settings-field">
                    <label>Confirm New Password</label>
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repeat new password"
                        disabled={isPending}
                    />
                    {confirm && newPw !== confirm && (
                        <p className="settings-field__hint settings-field__hint--error">
                            Passwords do not match
                        </p>
                    )}
                </div>

                {error && <p className="settings-error">{error}</p>}

                <button
                    className="settings-save-btn"
                    onClick={handleSave}
                    disabled={isPending || !current || !newPw || !confirm || newPw !== confirm || strength < 2}
                >
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Updating…</>
                        : saved
                        ? <><CheckCircle size={14} /> Password updated!</>
                        : "Update Password"
                    }
                </button>

            </div>
        </div>
    )
}