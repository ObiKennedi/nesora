// app/onboarding/creator/handle/page.tsx
"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { Loader2, CheckCircle, XCircle, AtSign } from "lucide-react"
import { checkHandleAvailability, saveCreatorHandleAction } from "@/actions/creator/handle"
import "@/styles/onboarding/CreatorHandle.scss"

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "error"

export default function CreatorHandlePage() {

    const [handle, setHandle] = useState("")
    const [availability, setAvailability] = useState<AvailabilityState>("idle")
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Debounced availability check as user types ────────────────────────────
    useEffect(() => {
        if (handle.length < 3) {
            setAvailability("idle")
            setErrorMsg(null)
            return
        }

        setAvailability("checking")

        if (debounceRef.current) clearTimeout(debounceRef.current)

        debounceRef.current = setTimeout(async () => {
            const result = await checkHandleAvailability(handle)

            if (result.error) {
                setAvailability("error")
                setErrorMsg(result.error)
            } else if (result.available) {
                setAvailability("available")
                setErrorMsg(null)
            } else {
                setAvailability("taken")
                setErrorMsg("This handle is already taken.")
            }
        }, 500)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [handle])

    const handleSubmit = () => {
        if (availability !== "available") return
        setFormError(null)

        startTransition(async () => {
            const res = await saveCreatorHandleAction(handle)
            if (res?.error) setFormError(res.error)
        })
    }

    const inputClass = [
        "handle-input",
        availability === "available" ? "handle-input--valid" : "",
        availability === "taken" ? "handle-input--invalid" : "",
        availability === "error" ? "handle-input--invalid" : "",
    ].filter(Boolean).join(" ")

    return (
        <div className="creator-handle">

            {/* Header */}
            <div className="creator-handle__header">
                <span className="creator-handle__eyebrow">Creator Onboarding</span>
                <h1>Pick your creator handle</h1>
                <p>
                    Your handle is your unique identity on NESORA. Fans will find
                    you at <strong>nesora.com/@yourhandle</strong>. Choose wisely
                    — you can change it later but consistency builds recognition.
                </p>
            </div>

            {/* Input */}
            <div className="creator-handle__field">
                <div className="handle-wrap">
                    <span className="handle-wrap__prefix">
                        <AtSign size={16} />
                    </span>

                    <input
                        type="text"
                        className={inputClass}
                        value={handle}
                        onChange={(e) => {
                            setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                            setFormError(null)
                        }}
                        placeholder="your_handle"
                        maxLength={30}
                        disabled={isPending}
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                    />

                    {/* Status icon */}
                    <span className="handle-wrap__status">
                        {availability === "checking" && <Loader2 size={16} className="spin" />}
                        {availability === "available" && <CheckCircle size={16} className="status--valid" />}
                        {(availability === "taken" ||
                            availability === "error") && <XCircle size={16} className="status--invalid" />}
                    </span>
                </div>

                {/* Feedback line */}
                <div className="handle-feedback">
                    {availability === "idle" && handle.length > 0 && handle.length < 3 && (
                        <span className="handle-feedback--hint">
                            At least 3 characters required
                        </span>
                    )}
                    {availability === "available" && (
                        <span className="handle-feedback--valid">
                            ✓ @{handle} is available
                        </span>
                    )}
                    {(availability === "taken" || availability === "error") && (
                        <span className="handle-feedback--invalid">
                            {errorMsg}
                        </span>
                    )}
                    {formError && (
                        <span className="handle-feedback--invalid">{formError}</span>
                    )}
                </div>

                {/* Rules */}
                <ul className="handle-rules">
                    <li className={handle.length >= 3 ? "rule--met" : ""}>
                        3–30 characters
                    </li>
                    <li className={/^[a-z0-9_]*$/.test(handle) && handle.length > 0 ? "rule--met" : ""}>
                        Letters, numbers, and underscores only
                    </li>
                    <li className={availability === "available" ? "rule--met" : ""}>
                        Must be unique
                    </li>
                </ul>
            </div>

            {/* Preview */}
            {handle.length >= 3 && (
                <div className="handle-preview">
                    <span className="handle-preview__label">Your public profile URL</span>
                    <span className="handle-preview__url">
                        nesora.com/<strong>@{handle || "yourhandle"}</strong>
                    </span>
                </div>
            )}

            {/* Submit */}
            <div className="creator-handle__action">
                <button
                    className="onboarding-submit"
                    onClick={handleSubmit}
                    disabled={availability !== "available" || isPending}
                >
                    {isPending
                        ? <><Loader2 size={16} className="spin" /> Saving…</>
                        : "Claim My Handle →"
                    }
                </button>

                <p className="creator-handle__skip">
                    <button
                        type="button"
                        className="skip-link"
                        onClick={() => {
                            startTransition(async () => {
                                const { redirect } = await import("next/navigation")
                            })
                            window.location.href = "/onboarding/creator/categories"
                        }}
                        disabled={isPending}
                    >
                        Skip for now
                    </button>
                    {" "}— you can set this from your profile settings
                </p>
            </div>

        </div>
    )
}