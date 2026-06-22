// components/creator/verification/AddressVerification.tsx
"use client"

import { useState, useTransition } from "react"
import { CheckCircle, Loader2, MapPin, Upload, ShieldCheck } from "lucide-react"
import { submitAddressAction } from "@/actions/creator/verification"

type Props = {
    verification: {
        addressLine:       string | null
        addressCity:       string | null
        addressState:      string | null
        addressCountry:    string | null
        addressProofImage: string | null
        addressVerified:   boolean
    } | null
    onSuccess: () => void
}

const uploadToCloudinary = async (file: File) => {
    const form = new FormData()
    form.append("file",          file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        "nesora/kyc/address")

    const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/auto/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message)
    return data.secure_url as string
}

export const AddressVerification = ({ verification, onSuccess }: Props) => {

    const [line,      setLine]      = useState(verification?.addressLine    ?? "")
    const [city,      setCity]      = useState(verification?.addressCity    ?? "")
    const [state,     setState]     = useState(verification?.addressState   ?? "")
    const [country,   setCountry]   = useState(verification?.addressCountry ?? "")
    const [proof,     setProof]     = useState(verification?.addressProofImage ?? "")
    const [uploading, setUploading] = useState(false)
    const [error,     setError]     = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const isComplete = !!proof
    const isLocked   = verification?.addressVerified === true

    const handleUpload = async (file: File) => {
        setUploading(true)
        try {
            const url = await uploadToCloudinary(file)
            setProof(url)
        } catch {
            setError("Upload failed. Try again.")
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = () => {
        setError(null)
        startTransition(async () => {
            const res = await submitAddressAction({
                addressLine:       line,
                addressCity:       city,
                addressState:      state,
                addressCountry:    country,
                addressProofImage: proof,
            })
            if (res?.error) setError(res.error)
            else onSuccess()
        })
    }

    return (
        <div className="verif-section">
            <div className="verif-section__header">
                <div className={`verif-section__icon ${isComplete ? "verif-section__icon--done" : ""}`}>
                    <MapPin size={18} />
                </div>
                <div>
                    <h3>Address Verification</h3>
                    <p>Upload a utility bill or bank statement showing your address.</p>
                </div>
                {isComplete && <span className="verif-section__check"><CheckCircle size={16} /></span>}
            </div>

            <div className="verif-section__body">
                {isLocked ? (
                    <div className="verif-locked-notice">
                        <ShieldCheck size={16} />
                        Your address has been verified.
                    </div>
                ) : (
                    <>
                        <div className="verif-form-field">
                            <label>Street Address</label>
                            <input
                                type="text"
                                placeholder="123 Main Street"
                                value={line}
                                onChange={(e) => setLine(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        <div className="verif-form-row">
                            <div className="verif-form-field">
                                <label>City</label>
                                <input
                                    type="text"
                                    placeholder="Lagos"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                            <div className="verif-form-field">
                                <label>State</label>
                                <input
                                    type="text"
                                    placeholder="Lagos State"
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                        </div>

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

                        <label className={`verif-upload-zone verif-upload-zone--wide ${proof ? "verif-upload-zone--done" : ""}`}>
                            <input
                                type="file"
                                accept="image/*,.pdf"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) handleUpload(file)
                                }}
                                disabled={isPending}
                            />
                            {proof ? (
                                <img src={proof} alt="Address proof" />
                            ) : (
                                <div className="verif-upload-zone__placeholder">
                                    {uploading
                                        ? <Loader2 size={20} className="spin" />
                                        : <Upload  size={20} />
                                    }
                                    <span>Upload proof of address</span>
                                </div>
                            )}
                        </label>

                        {error && <p className="verif-section__error">{error}</p>}

                        <button
                            className="verif-save-btn"
                            onClick={handleSubmit}
                            disabled={isPending || !line || !city || !country || !proof}
                        >
                            {isPending ? <Loader2 size={14} className="spin" /> : null}
                            Submit for Review
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}