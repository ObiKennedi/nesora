"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { Loader2, CheckCircle, XCircle, AtSign } from "lucide-react"
import { checkFanUsernameAvailability, saveFanUsernameAction } from "@/actions/fan/username"
import "@/styles/onboarding/FanUsername.scss"

type AvailabilityState = "idle" | "checking" | "available" | "taken" | "error"

export default function FanUsernamePage() {

    const [username,     setUsername]     = useState("")
    const [availability, setAvailability] = useState<AvailabilityState>("idle")
    const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
    const [formError,    setFormError]    = useState<string | null>(null)
    const [isPending,    startTransition] = useTransition()

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Debounced availability check ──────────────────────────────────────────
    useEffect(() => {
        if (username.length < 3) {
            setAvailability("idle")
            setErrorMsg(null)
            return
        }

        setAvailability("checking")

        if (debounceRef.current) clearTimeout(debounceRef.current)

        debounceRef.current = setTimeout(async () => {
            const result = await checkFanUsernameAvailability(username)

            if (result.error) {
                setAvailability("error")
                setErrorMsg(result.error)
            } else if (result.available) {
                setAvailability("available")
                setErrorMsg(null)
            } else {
                setAvailability("taken")
                setErrorMsg("This username is already taken.")
            }
        }, 500)

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [username])

    const handleSubmit = () => {
        if (availability !== "available") return
        setFormError(null)

        startTransition(async () => {
            const res = await saveFanUsernameAction(username)
            if (res?.error) setFormError(res.error)
        })
    }

    const inputClass = [
        "handle-input",
        availability === "available" ? "handle-input--valid"   : "",
        availability === "taken"     ? "handle-input--invalid" : "",
        availability === "error"     ? "handle-input--invalid" : "",
    ].filter(Boolean).join(" ")

    return (
        <div className="fan-username">

            {/* Header */}
            <div className="fan-username__header">
                <span className="fan-username__eyebrow">Fan Onboarding</span>
                <h1>Choose your username</h1>
                <p>
                    This is how creators and other fans will know you on NESORA.
                    Your profile will live at{" "}
                    <strong>nesora.com/@yourusername</strong>. You can change it
                    anytime from your profile settings.
                </p>
            </div>

            {/* Input */}
            <div className="fan-username__field">
                <div className="handle-wrap">
                    <span className="handle-wrap__prefix">
                        <AtSign size={16} />
                    </span>

                    <input
                        type="text"
                        className={inputClass}
                        value={username}
                        onChange={(e) => {
                            setUsername(
                                e.target.value
                                    .toLowerCase()
                                    .replace(/[^a-z0-9_]/g, "")
                            )
                            setFormError(null)
                        }}
                        placeholder="your_username"
                        maxLength={30}
                        disabled={isPending}
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                    />

                    {/* Status icon */}
                    <span className="handle-wrap__status">
                        {availability === "checking" && (
                            <Loader2 size={16} className="spin" />
                        )}
                        {availability === "available" && (
                            <CheckCircle size={16} className="status--valid" />
                        )}
                        {(availability === "taken" || availability === "error") && (
                            <XCircle size={16} className="status--invalid" />
                        )}
                    </span>
                </div>

                {/* Feedback */}
                <div className="handle-feedback">
                    {availability === "idle" && username.length > 0 && username.length < 3 && (
                        <span className="handle-feedback--hint">
                            At least 3 characters required
                        </span>
                    )}
                    {availability === "available" && (
                        <span className="handle-feedback--valid">
                            ✓ @{username} is available
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
                    <li className={username.length >= 3 ? "rule--met" : ""}>
                        3–30 characters
                    </li>
                    <li className={
                        /^[a-z0-9_]*$/.test(username) && username.length > 0
                            ? "rule--met"
                            : ""
                    }>
                        Letters, numbers, and underscores only
                    </li>
                    <li className={availability === "available" ? "rule--met" : ""}>
                        Must be unique
                    </li>
                </ul>
            </div>

            {/* Preview */}
            {username.length >= 3 && (
                <div className="handle-preview">
                    <span className="handle-preview__label">Your public profile URL</span>
                    <span className="handle-preview__url">
                        nesora.com/<strong>@{username}</strong>
                    </span>
                </div>
            )}

            {/* Submit */}
            <div className="fan-username__action">
                <button
                    className="onboarding-submit"
                    onClick={handleSubmit}
                    disabled={availability !== "available" || isPending}
                >
                    {isPending
                        ? <><Loader2 size={16} className="spin" /> Saving…</>
                        : "Claim My Username →"
                    }
                </button>

                <p className="fan-username__skip">
                    <button
                        type="button"
                        className="skip-link"
                        onClick={() => {
                            window.location.href = "/onboarding/fan/categories"
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