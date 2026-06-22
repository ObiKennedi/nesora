// components/creator/verification/SelfieVerification.tsx
"use client"

import { useState, useTransition, useRef } from "react"
import { CheckCircle, Loader2, Camera, ShieldCheck } from "lucide-react"
import { submitSelfieAction } from "@/actions/creator/verification"

type Props = {
    verification: {
        selfieImage:    string | null
        selfieVerified: boolean
    } | null
    onSuccess: () => void
}

const uploadToCloudinary = async (file: File) => {
    const form = new FormData()
    form.append("file",          file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        "nesora/kyc/selfies")

    const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message)
    return data.secure_url as string
}

export const SelfieVerification = ({ verification, onSuccess }: Props) => {

    const [selfie,    setSelfie]    = useState(verification?.selfieImage ?? "")
    const [uploading, setUploading] = useState(false)
    const [error,     setError]     = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const fileRef = useRef<HTMLInputElement>(null)

    const isComplete = !!selfie
    const isLocked   = verification?.selfieVerified === true

    const handleUpload = async (file: File) => {
        setUploading(true)
        setError(null)
        try {
            const url = await uploadToCloudinary(file)
            setSelfie(url)

            startTransition(async () => {
                const res = await submitSelfieAction(url)
                if (res?.error) setError(res.error)
                else onSuccess()
            })
        } catch {
            setError("Upload failed. Try again.")
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="verif-section">
            <div className="verif-section__header">
                <div className={`verif-section__icon ${isComplete ? "verif-section__icon--done" : ""}`}>
                    <Camera size={18} />
                </div>
                <div>
                    <h3>Selfie Verification</h3>
                    <p>Take a clear selfie holding your ID next to your face.</p>
                </div>
                {isComplete && <span className="verif-section__check"><CheckCircle size={16} /></span>}
            </div>

            <div className="verif-section__body">
                {isLocked ? (
                    <div className="verif-locked-notice">
                        <ShieldCheck size={16} />
                        Your selfie has been verified.
                    </div>
                ) : (
                    <>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            capture="user"
                            style={{ display: "none" }}
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUpload(file)
                            }}
                        />

                        <button
                            type="button"
                            className={`verif-selfie-zone ${selfie ? "verif-selfie-zone--done" : ""}`}
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading || isPending}
                        >
                            {selfie ? (
                                <img src={selfie} alt="Selfie" />
                            ) : (
                                <div className="verif-selfie-zone__placeholder">
                                    {uploading || isPending
                                        ? <Loader2 size={24} className="spin" />
                                        : <Camera  size={24} />
                                    }
                                    <span>{uploading ? "Uploading…" : "Take or upload selfie"}</span>
                                </div>
                            )}
                        </button>

                        <p className="verif-hint">
                            Hold your ID document next to your face so both are clearly visible.
                        </p>

                        {error && <p className="verif-section__error">{error}</p>}
                    </>
                )}
            </div>
        </div>
    )
}