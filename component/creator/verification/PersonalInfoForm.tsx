// components/creator/verification/PersonalInfoForm.tsx
"use client"

import { useState, useTransition } from "react"
import { CheckCircle, Loader2, User } from "lucide-react"
import { updatePersonalInfoAction }  from "@/actions/creator/verification"

type Props = {
    profile: {
        dateOfBirth: Date | null
        gender:      string | null
        country:     string | null
        city:        string | null
        firstName:   string | null
        lastName:    string | null
        username:    string | null
    } | null
    onSuccess: () => void
}

const fmtDate = (d: Date | null) => d ? new Date(d).toISOString().split("T")[0] : ""

export const PersonalInfoForm = ({ profile, onSuccess }: Props) => {

    const [dateOfBirth, setDateOfBirth] = useState(fmtDate(profile?.dateOfBirth ?? null))
    const [gender,      setGender]      = useState(profile?.gender ?? "")
    const [country,     setCountry]     = useState(profile?.country ?? "")
    const [city,        setCity]        = useState(profile?.city ?? "")
    const [error,       setError]       = useState<string | null>(null)
    const [saved,       setSaved]       = useState(false)
    const [isPending,   startTransition] = useTransition()

    const isComplete = !!profile?.dateOfBirth

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await updatePersonalInfoAction({
                dateOfBirth,
                gender:  gender as any || undefined,
                country,
                city: city || undefined,
            })
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
        <div className="verif-section">
            <div className="verif-section__header">
                <div className={`verif-section__icon ${isComplete ? "verif-section__icon--done" : ""}`}>
                    <User size={18} />
                </div>
                <div>
                    <h3>Personal Information</h3>
                    <p>Your date of birth and location help us verify your identity.</p>
                </div>
                {isComplete && (
                    <span className="verif-section__check"><CheckCircle size={16} /></span>
                )}
            </div>

            <div className="verif-section__body">
                <div className="verif-form-row">
                    <div className="verif-form-field">
                        <label>Date of Birth</label>
                        <input
                            type="date"
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="verif-form-field">
                        <label>Gender <span>— optional</span></label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)} disabled={isPending}>
                            <option value="">Select</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                        </select>
                    </div>
                </div>

                <div className="verif-form-row">
                    <div className="verif-form-field">
                        <label>Country</label>
                        <input
                            type="text"
                            placeholder="Nigeria"
                            value={country}
                            onChange={(e) => setCountry(e.target.value)}
                            disabled={isPending}
                        />
                    </div>
                    <div className="verif-form-field">
                        <label>City <span>— optional</span></label>
                        <input
                            type="text"
                            placeholder="Lagos"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            disabled={isPending}
                        />
                    </div>
                </div>

                {error && <p className="verif-section__error">{error}</p>}

                <button
                    className="verif-save-btn"
                    onClick={handleSave}
                    disabled={isPending || !dateOfBirth || !country}
                >
                    {isPending
                        ? <Loader2 size={14} className="spin" />
                        : saved ? <CheckCircle size={14} /> : null
                    }
                    {saved ? "Saved!" : "Save Information"}
                </button>
            </div>
        </div>
    )
}