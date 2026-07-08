// component/calls/IncomingCallModal.tsx
"use client"

import { useEffect, useState } from "react"
import Image                    from "next/image"
import { Phone, Video, PhoneOff, Star } from "lucide-react"
import { useCall }              from "./CallProvider"
import "@/styles/calls/CallOverlay.scss"

const RING_SECONDS = 45

export const IncomingCallModal = () => {
    const { incoming, acceptIncoming, declineIncoming } = useCall()
    const [secondsLeft, setSecondsLeft] = useState(RING_SECONDS)
    const [acting,      setActing]      = useState(false)

    useEffect(() => {
        setSecondsLeft(RING_SECONDS)
        const t = setInterval(() => {
            setSecondsLeft((s) => Math.max(0, s - 1))
        }, 1_000)
        return () => clearInterval(t)
    }, [incoming?.callId])

    useEffect(() => {
        if (secondsLeft === 0 && !acting) void declineDismiss()
    }, [secondsLeft])

    if (!incoming) return null

    const isVideo = incoming.type === "VIDEO"
    const priceLabel = incoming.isFreeCall
        ? "Free call"
        : `₦${incoming.ratePerHour.toLocaleString()}/hr`

    const handleAccept = async () => {
        if (acting) return
        setActing(true)
        await acceptIncoming()
        setActing(false)
    }

    const declineDismiss = async () => {
        if (acting) return
        setActing(true)
        await declineIncoming()
        setActing(false)
    }

    return (
        <div className="incoming-call">
            <div className="incoming-call__card">

                <div className="incoming-call__avatar">
                    {incoming.fan.image ? (
                        <Image
                            src={incoming.fan.image}
                            alt={incoming.fan.name}
                            width={72}
                            height={72}
                        />
                    ) : (
                        <span>{incoming.fan.name.charAt(0).toUpperCase()}</span>
                    )}
                    <span className="incoming-call__pulse" />
                </div>

                <p className="incoming-call__name">{incoming.fan.name}</p>

                <p className="incoming-call__kind">
                    {isVideo ? <Video size={14} /> : <Phone size={14} />}
                    Incoming {isVideo ? "video" : "voice"} call
                </p>

                <span
                    className={`incoming-call__price ${incoming.isFreeCall ? "incoming-call__price--free" : ""}`}
                >
                    {incoming.isFreeCall && <Star size={11} />}
                    {priceLabel}
                </span>

                <div className="incoming-call__actions">
                    <button
                        className="call-action-btn call-action-btn--decline"
                        onClick={declineDismiss}
                        disabled={acting}
                        aria-label="Decline"
                    >
                        <PhoneOff size={22} />
                    </button>
                    <button
                        className="call-action-btn call-action-btn--accept"
                        onClick={handleAccept}
                        disabled={acting}
                        aria-label="Accept"
                    >
                        {isVideo ? <Video size={22} /> : <Phone size={22} />}
                    </button>
                </div>

                <p className="incoming-call__countdown">{secondsLeft}s</p>
            </div>
        </div>
    )
}