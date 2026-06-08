// app/onboarding/creator/verify/page.tsx
"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
    Loader2, CircleX, Upload,
    ChevronRight, ShieldCheck,
} from "lucide-react"
import { submitKYCAction, skipKYCAction } from "@/actions/auth/creator-kyc"
import "@/styles/onboarding/CreatorKYC.scss"

const KYCSchema = z.object({
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    idType: z.enum(
        ["NATIONAL_ID", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD"],
        { message: "Select an ID type" }
    ),
    idNumber: z.string().min(1, "ID number is required"),
    idFrontImage: z.string().min(1, "Front image is required"),
    idBackImage: z.string().min(1, "Back image is required"),
    bvnOrTaxId: z.string().optional(),
})

type KYCValues = z.infer<typeof KYCSchema>

// ── Cloudinary upload helper ──────────────────────────────────────────────────

const uploadToCloudinary = async (file: File): Promise<string> => {
    const form = new FormData()
    form.append("file", file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder", "nesora/kyc")

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? "Upload failed")
    return data.secure_url as string
}

// ── Image upload field ────────────────────────────────────────────────────────

const ImageUploadField = ({
    label,
    hint,
    value,
    onChange,
    error,
    disabled,
}: {
    label: string
    hint: string
    value: string
    onChange: (url: string) => void
    error?: string
    disabled: boolean
}) => {
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<string | null>(null)

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setPreview(URL.createObjectURL(file))
        setUploading(true)
        try {
            const url = await uploadToCloudinary(file)
            onChange(url)
        } catch {
            // Surface error via RHF
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className={`kyc-upload ${error ? "kyc-upload--error" : ""} ${value ? "kyc-upload--done" : ""}`}>
            <label className="kyc-upload__label">{label}</label>
            <label className="kyc-upload__zone">
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    disabled={disabled || uploading}
                    className="kyc-upload__input"
                />
                {preview ? (
                    <div className="kyc-upload__preview">
                        <img src={preview} alt="ID preview" />
                        {uploading && (
                            <div className="kyc-upload__uploading">
                                <Loader2 size={20} className="spin" />
                            </div>
                        )}
                        {value && !uploading && (
                            <div className="kyc-upload__done-badge">
                                <ShieldCheck size={16} />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="kyc-upload__placeholder">
                        {uploading
                            ? <Loader2 size={22} className="spin" />
                            : <Upload size={22} />
                        }
                        <span>{uploading ? "Uploading…" : hint}</span>
                    </div>
                )}
            </label>
            {error && <p className="kyc-upload__error">{error}</p>}
        </div>
    )
}

// ── Steps indicator ───────────────────────────────────────────────────────────

const steps = ["Personal Details", "Identity Document", "Review & Submit"]

const StepBar = ({ current }: { current: number }) => (
    <div className="kyc-steps">
        {steps.map((step, i) => (
            <div
                key={step}
                className={`kyc-step ${i < current ? "kyc-step--done" :
                        i === current ? "kyc-step--active" : ""
                    }`}
            >
                <div className="kyc-step__bubble">
                    {i < current ? (
                        <svg viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    ) : (
                        <span>{i + 1}</span>
                    )}
                </div>
                <span className="kyc-step__label">{step}</span>
                {i < steps.length - 1 && <div className="kyc-step__line" />}
            </div>
        ))}
    </div>
)

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreatorVerifyPage() {

    const [step, setStep] = useState(0)
    const [feedback, setFeedback] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [isSkipping, startSkip] = useTransition()

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        trigger,
        formState: { errors },
    } = useForm<KYCValues>({ resolver: zodResolver(KYCSchema) })

    const frontImage = watch("idFrontImage", "")
    const backImage = watch("idBackImage", "")

    const handleNext = async () => {
        const fields: (keyof KYCValues)[][] = [
            ["dateOfBirth"],
            ["idType", "idNumber", "idFrontImage", "idBackImage"],
        ]
        const valid = await trigger(fields[step])
        if (valid) setStep((s) => s + 1)
    }

    const onSubmit = (values: KYCValues) => {
        setFeedback(null)
        startTransition(async () => {
            const res = await submitKYCAction(values)
            if (res?.error) setFeedback(res.error)
            // success redirects server-side to /dashboard
        })
    }

    const handleSkip = () => {
        startSkip(async () => {
            await skipKYCAction()
        })
    }

    return (
        <div className="creator-kyc">

            {/* ── Header ── */}
            <div className="creator-kyc__header">
                <span className="creator-kyc__eyebrow">Creator Onboarding</span>
                <h1>Verify your identity</h1>
                <p>
                    Verification builds trust with your audience. It only takes
                    a few minutes and your data is encrypted and secure.
                </p>
            </div>

            <StepBar current={step} />

            <div className="creator-kyc__card">
                <form
                    onSubmit={handleSubmit(onSubmit)}
                    noValidate
                >

                    {/* ── Step 0: Personal Details ── */}
                    {step === 0 && (
                        <div className="kyc-step-content">
                            <h2>Personal details</h2>
                            <p>Enter your legal information exactly as it appears on your ID.</p>

                            <div className="kyc-fields">
                                <div className="kyc-field">
                                    <label htmlFor="dateOfBirth">Date of Birth</label>
                                    <input
                                        id="dateOfBirth"
                                        type="date"
                                        disabled={isPending}
                                        {...register("dateOfBirth")}
                                        className={errors.dateOfBirth ? "input--error" : ""}
                                    />
                                    {errors.dateOfBirth && (
                                        <span className="kyc-field__error">
                                            {errors.dateOfBirth.message}
                                        </span>
                                    )}
                                </div>

                                <div className="kyc-field">
                                    <label htmlFor="bvnOrTaxId">
                                        BVN or Tax ID
                                        <span className="kyc-field__optional"> — optional</span>
                                    </label>
                                    <input
                                        id="bvnOrTaxId"
                                        type="text"
                                        placeholder="Enter your BVN or Tax ID number"
                                        disabled={isPending}
                                        {...register("bvnOrTaxId")}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 1: Identity Document ── */}
                    {step === 1 && (
                        <div className="kyc-step-content">
                            <h2>Identity document</h2>
                            <p>Upload a clear photo of a valid government-issued ID.</p>

                            <div className="kyc-fields">
                                <div className="kyc-field">
                                    <label htmlFor="idType">ID Type</label>
                                    <select
                                        id="idType"
                                        disabled={isPending}
                                        {...register("idType")}
                                        className={errors.idType ? "input--error" : ""}
                                    >
                                        <option value="">Select ID type</option>
                                        <option value="NATIONAL_ID">National ID Card</option>
                                        <option value="PASSPORT">International Passport</option>
                                        <option value="DRIVERS_LICENSE">Driver's License</option>
                                        <option value="VOTERS_CARD">Voter's Card</option>
                                    </select>
                                    {errors.idType && (
                                        <span className="kyc-field__error">
                                            {errors.idType.message}
                                        </span>
                                    )}
                                </div>

                                <div className="kyc-field">
                                    <label htmlFor="idNumber">ID Number</label>
                                    <input
                                        id="idNumber"
                                        type="text"
                                        placeholder="Enter the number on your ID"
                                        disabled={isPending}
                                        {...register("idNumber")}
                                        className={errors.idNumber ? "input--error" : ""}
                                    />
                                    {errors.idNumber && (
                                        <span className="kyc-field__error">
                                            {errors.idNumber.message}
                                        </span>
                                    )}
                                </div>

                                <div className="kyc-uploads">
                                    <ImageUploadField
                                        label="Front of ID"
                                        hint="Tap to upload front of ID"
                                        value={frontImage}
                                        onChange={(url) => setValue("idFrontImage", url, { shouldValidate: true })}
                                        error={errors.idFrontImage?.message}
                                        disabled={isPending}
                                    />
                                    <ImageUploadField
                                        label="Back of ID"
                                        hint="Tap to upload back of ID"
                                        value={backImage}
                                        onChange={(url) => setValue("idBackImage", url, { shouldValidate: true })}
                                        error={errors.idBackImage?.message}
                                        disabled={isPending}
                                    />
                                </div>

                                <div className="kyc-notice">
                                    <ShieldCheck size={14} />
                                    <span>
                                        Your ID images are encrypted and only used for
                                        verification. They are never shared publicly.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Review ── */}
                    {step === 2 && (
                        <div className="kyc-step-content">
                            <h2>Review & submit</h2>
                            <p>
                                Our team will review your submission within 24–48 hours.
                                You'll receive an email once verified.
                            </p>

                            <div className="kyc-review">
                                <div className="kyc-review__row">
                                    <span>Date of Birth</span>
                                    <strong>{watch("dateOfBirth")}</strong>
                                </div>
                                <div className="kyc-review__row">
                                    <span>ID Type</span>
                                    <strong>
                                        {{
                                            NATIONAL_ID: "National ID Card",
                                            PASSPORT: "International Passport",
                                            DRIVERS_LICENSE: "Driver's License",
                                            VOTERS_CARD: "Voter's Card",
                                        }[watch("idType")] ?? "—"}
                                    </strong>
                                </div>
                                <div className="kyc-review__row">
                                    <span>ID Number</span>
                                    <strong>{watch("idNumber")}</strong>
                                </div>
                                {watch("bvnOrTaxId") && (
                                    <div className="kyc-review__row">
                                        <span>BVN / Tax ID</span>
                                        <strong>{watch("bvnOrTaxId")}</strong>
                                    </div>
                                )}
                                <div className="kyc-review__images">
                                    <div className="kyc-review__img">
                                        <span>Front</span>
                                        <img src={watch("idFrontImage")} alt="ID Front" />
                                    </div>
                                    <div className="kyc-review__img">
                                        <span>Back</span>
                                        <img src={watch("idBackImage")} alt="ID Back" />
                                    </div>
                                </div>
                            </div>

                            {feedback && (
                                <div className="auth-feedback auth-feedback--error" style={{ marginTop: "1rem" }}>
                                    <CircleX size={15} />
                                    <span>{feedback}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Navigation ── */}
                    <div className="kyc-nav">
                        {step > 0 && (
                            <button
                                type="button"
                                className="kyc-nav__back"
                                onClick={() => setStep((s) => s - 1)}
                                disabled={isPending}
                            >
                                Back
                            </button>
                        )}

                        <div className="kyc-nav__right">
                            <button
                                type="button"
                                className="kyc-nav__skip"
                                onClick={handleSkip}
                                disabled={isPending || isSkipping}
                            >
                                {isSkipping
                                    ? <><Loader2 size={14} className="spin" /> Skipping…</>
                                    : "Skip for now"
                                }
                            </button>

                            {step < 2 ? (
                                <button
                                    type="button"
                                    className="kyc-nav__next"
                                    onClick={handleNext}
                                    disabled={isPending}
                                >
                                    Next <ChevronRight size={16} />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    className="kyc-nav__submit"
                                    disabled={isPending}
                                >
                                    {isPending
                                        ? <><Loader2 size={16} className="spin" /> Submitting…</>
                                        : <><ShieldCheck size={16} /> Submit for Verification</>
                                    }
                                </button>
                            )}
                        </div>
                    </div>

                </form>
            </div>

            {/* ── Skip note ── */}
            <p className="creator-kyc__skip-note">
                Skipping verification means your profile will show as unverified.
                You can complete this later from your creator settings.
            </p>

        </div>
    )
}