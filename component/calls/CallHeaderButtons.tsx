"use client"

import { useState } from "react"
import { Phone, Video, Loader2 } from "lucide-react"
import { useCall, type CallKind, type Counterpart } from "./CallProvider"
import "@/styles/calls/CallOverlay.scss"

type Props = {
    conversationId: string
    counterpart:    Counterpart
    onError?: (message: string, code?: string, required?: number) => void
}

export const CallHeaderButtons = ({ conversationId, counterpart, onError }: Props) => {
    const { startCall, phase } = useCall()
    const [starting, setStarting] = useState<CallKind | null>(null)

    const busy = phase !== "idle" || starting !== null

    const handleStart = async (type: CallKind) => {
        if (busy) return
        setStarting(type)
        const failure = await startCall({ conversationId, type, counterpart })
        setStarting(null)

        if (failure) {
            if (onError) {
                onError(failure.error, failure.code, failure.required)
            } else if (failure.code === "INSUFFICIENT_BALANCE" && failure.required) {
                alert(`${failure.error}\n\nTop up your wallet to start this call.`)
            } else {
                alert(failure.error)
            }
        }
    }

    return (
        <div className="call-header-btns">
            <button
                className="call-header-btn"
                onClick={() => void handleStart("VOICE")}
                disabled={busy}
                title="Voice call"
                aria-label="Start voice call"
            >
                {starting === "VOICE"
                    ? <Loader2 size={17} className="spin" />
                    : <Phone size={17} />}
            </button>
            <button
                className="call-header-btn"
                onClick={() => void handleStart("VIDEO")}
                disabled={busy}
                title="Video call"
                aria-label="Start video call"
            >
                {starting === "VIDEO"
                    ? <Loader2 size={17} className="spin" />
                    : <Video size={17} />}
            </button>
        </div>
    )
}