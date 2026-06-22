// components/creator/verification/IdentityDocumentsForm.tsx
"use client"

import { useState, useTransition } from "react"
import {
    CheckCircle, Loader2, FileCheck,
    Upload, ShieldCheck,
} from "lucide-react"
import { submitIdentityDocumentsAction } from "@/actions/creator/verification"
import { IdType } from "@prisma/client"

type Props = {
    verification: {
        idType:       string | null
        idNumber:     string | null
        idFrontImage: string | null
        idBackImage:  string | null
        bvnOrTaxId:   string | null
        status:       string
    } | null
    onSuccess: () => void
}

const uploadToCloudinary = async (file: File) => {
    const form = new FormData()
    form.append("file",          file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        "nesora/kyc")

    const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message)
    return data.secure_url as string
}

export const IdentityDocumentsForm = ({ verification, onSuccess }: Props) => {

    const [idType,    setIdType]    = useState(verification?.idType ?? "")
    const [idNumber,  setIdNumber]  = useState(verification?.idNumber ?? "")
    const [front,     setFront]     = useState(verification?.idFrontImage ?? "")
    const [back,      setBack]      = useState(verification?.idBackImage  ?? "")
    const [bvn,       setBvn]       = useState(verification?.bvnOrTaxId ?? "")
    const [uploading, setUploading] = useState<"front" | "back" | null>(null)
    const [error,     setError]     = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const isComplete = !!front && !!back
    const isLocked   = verification?.status === "APPROVED"

    const handleUpload = async (side: "front" | "back", file: File) => {
        setUploading(side)
        try {
            const url = await uploadToCloudinary(file)
            side === "front" ? setFront(url) : setBack(url)
        } catch {
            setError("Upload failed. Try again.")
        } finally {
            setUploading(null)
        }
    }

    const handleSubmit = () => {
        setError(null)
        startTransition(async () => {
            const res = await submitIdentityDocumentsAction({
                idType:       idType as IdType,
                idNumber,
                idFrontImage: front,
                idBackImage:  back,
                bvnOrTaxId:   bvn || undefined,
            })
            if (res?.error) setError(res.error)
            else onSuccess()
        })
    }

    return (
        <div className="verif-section">
            <div className="verif-section__header">
                <div className={`verif-section__icon ${isComplete ? "verif-section__icon--done" : ""}`}>
                    <FileCheck size={18} />
                </div>
                <div>
                    <h3>Identity Document</h3>
                    <p>Upload a government-issued ID for verification.</p>
                </div>
                {isComplete && <span className="verif-section__check"><CheckCircle size={16} /></span>}
            </div>

            <div className="verif-section__body">
                {isLocked ? (
                    <div className="verif-locked-notice">
                        <ShieldCheck size={16} />
                        Your identity document has been verified and cannot be edited.
                    </div>
                ) : (
                    <>
                        <div className="verif-form-row">
                            <div className="verif-form-field">
                                <label>ID Type</label>
                                <select value={idType} onChange={(e) => setIdType(e.target.value)} disabled={isPending}>
                                    <option value="">Select ID type</option>
                                    <option value="NATIONAL_ID">National ID Card</option>
                                    <option value="PASSPORT">International Passport</option>
                                    <option value="DRIVERS_LICENSE">Driver's License</option>
                                    <option value="VOTERS_CARD">Voter's Card</option>
                                </select>
                            </div>
                            <div className="verif-form-field">
                                <label>ID Number</label>
                                <input
                                    type="text"
                                    placeholder="Enter ID number"
                                    value={idNumber}
                                    onChange={(e) => setIdNumber(e.target.value)}
                                    disabled={isPending}
                                />
                            </div>
                        </div>

                        <div className="verif-uploads">
                            {(["front", "back"] as const).map((side) => {
                                const value = side === "front" ? front : back
                                return (
                                    <label key={side} className={`verif-upload-zone ${value ? "verif-upload-zone--done" : ""}`}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                if (file) handleUpload(side, file)
                                            }}
                                            disabled={isPending}
                                        />
                                        {value ? (
                                            <img src={value} alt={`ID ${side}`} />
                                        ) : (
                                            <div className="verif-upload-zone__placeholder">
                                                {uploading === side
                                                    ? <Loader2 size={20} className="spin" />
                                                    : <Upload  size={20} />
                                                }
                                                <span>{side === "front" ? "Front of ID" : "Back of ID"}</span>
                                            </div>
                                        )}
                                    </label>
                                )
                            })}
                        </div>

                        <div className="verif-form-field">
                            <label>BVN or Tax ID <span>— optional</span></label>
                            <input
                                type="text"
                                placeholder="Enter BVN or Tax ID"
                                value={bvn}
                                onChange={(e) => setBvn(e.target.value)}
                                disabled={isPending}
                            />
                        </div>

                        {error && <p className="verif-section__error">{error}</p>}

                        <button
                            className="verif-save-btn"
                            onClick={handleSubmit}
                            disabled={isPending || !idType || !idNumber || !front || !back}
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