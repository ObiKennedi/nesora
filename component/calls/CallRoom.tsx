// component/calls/CallRoom.tsx
"use client"

import { useEffect, useRef } from "react"
import Image                  from "next/image"
import {
    Mic, MicOff, Video, VideoOff,
    PhoneOff, AlertTriangle, X,
} from "lucide-react"
import { useCall } from "./CallProvider"
import "@/styles/calls/CallOverlay.scss"

// ── Small helpers ─────────────────────────────────────────────────────────────

const fmtElapsed = (s: number) => {
    const m   = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, "0")}`
}

/** Client-side display estimate only — the server bills authoritatively. */
const runningCost = (elapsedSeconds: number, ratePerHour: number) => {
    const minutes = Math.max(1, Math.ceil(elapsedSeconds / 60))
    return Math.round((ratePerHour / 60) * minutes * 100) / 100
}

const TrackVideo = ({
    track, muted, mirrored,
}: { track: MediaStreamTrack; muted?: boolean; mirrored?: boolean }) => {
    const ref = useRef<HTMLVideoElement>(null)
    useEffect(() => {
        if (ref.current) ref.current.srcObject = new MediaStream([track])
    }, [track])
    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            className={mirrored ? "call-video--mirrored" : undefined}
        />
    )
}

const TrackAudio = ({ track }: { track: MediaStreamTrack }) => {
    const ref = useRef<HTMLAudioElement>(null)
    useEffect(() => {
        if (ref.current) ref.current.srcObject = new MediaStream([track])
    }, [track])
    return <audio ref={ref} autoPlay />
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CallRoom = () => {
    const {
        phase, activeCall, endSummary,
        elapsedSeconds, lowBalance,
        isMuted, isCameraOff,
        localVideoTrack, remote,
        hangUp, toggleMute, toggleCamera, dismissSummary,
    } = useCall()

    // ── End summary card (shown after any call, over anything) ────────────
    if (endSummary && phase === "idle") {
        const statusLabel =
            endSummary.status === "MISSED"   ? "No answer"   :
            endSummary.status === "DECLINED" ? "Call declined" :
            endSummary.status === "FAILED"   ? "Call failed" : "Call ended"

        return (
            <div className="call-summary">
                <div className="call-summary__card">
                    <button
                        className="call-summary__close"
                        onClick={dismissSummary}
                        aria-label="Dismiss"
                    >
                        <X size={16} />
                    </button>

                    <div className="call-summary__avatar">
                        {endSummary.counterpart.image ? (
                            <Image
                                src={endSummary.counterpart.image}
                                alt={endSummary.counterpart.name}
                                width={56}
                                height={56}
                            />
                        ) : (
                            <span>{endSummary.counterpart.name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>

                    <p className="call-summary__status">{statusLabel}</p>
                    <p className="call-summary__name">{endSummary.counterpart.name}</p>

                    {endSummary.status === "ENDED" && (
                        <p className="call-summary__detail">
                            {endSummary.durationMinutes} min
                            {endSummary.billedAmount > 0 &&
                                ` · ₦${endSummary.billedAmount.toLocaleString()}`}
                        </p>
                    )}

                    {endSummary.reason === "insufficient-balance" && (
                        <p className="call-summary__reason">
                            <AlertTriangle size={12} />
                            Ended — wallet balance ran out
                        </p>
                    )}
                </div>
            </div>
        )
    }

    if (!activeCall || phase === "idle") return null

    const isVideo   = activeCall.type === "VIDEO"
    const isRinging = phase === "outgoing-ringing" || phase === "connecting"
    const showCost  = !activeCall.isFreeCall && phase === "in-call"

    return (
        <div className={`call-room ${isVideo ? "call-room--video" : "call-room--voice"}`}>

            {/* Remote audio always plays (voice AND video) */}
            {remote?.audioTrack && <TrackAudio track={remote.audioTrack} />}

            {/* ── Video layer ── */}
            {isVideo && remote?.videoTrack && phase === "in-call" ? (
                <div className="call-room__remote-video">
                    <TrackVideo track={remote.videoTrack} />
                </div>
            ) : (
                /* Voice call, ringing, or remote camera off → avatar stage */
                <div className="call-room__stage">
                    <div className={`call-room__avatar ${isRinging ? "call-room__avatar--ringing" : ""}`}>
                        {activeCall.counterpart.image ? (
                            <Image
                                src={activeCall.counterpart.image}
                                alt={activeCall.counterpart.name}
                                width={112}
                                height={112}
                            />
                        ) : (
                            <span>{activeCall.counterpart.name.charAt(0).toUpperCase()}</span>
                        )}
                    </div>

                    <p className="call-room__name">{activeCall.counterpart.name}</p>

                    <p className="call-room__status">
                        {phase === "outgoing-ringing" ? "Ringing…"
                            : phase === "connecting"  ? "Connecting…"
                            : fmtElapsed(elapsedSeconds)}
                    </p>
                </div>
            )}

            {/* ── Video-mode header (name + timer over the feed) ── */}
            {isVideo && phase === "in-call" && remote?.videoTrack && (
                <div className="call-room__video-header">
                    <span>{activeCall.counterpart.name}</span>
                    <span>{fmtElapsed(elapsedSeconds)}</span>
                </div>
            )}

            {/* ── Local PiP ── */}
            {isVideo && localVideoTrack && !isCameraOff && phase === "in-call" && (
                <div className="call-room__local-video">
                    <TrackVideo track={localVideoTrack} muted mirrored />
                </div>
            )}

            {/* ── Cost ticker (display estimate; server bills) ── */}
            {showCost && (
                <div className="call-room__cost">
                    ₦{runningCost(elapsedSeconds, activeCall.ratePerHour).toLocaleString()} so far
                    · ₦{activeCall.ratePerHour.toLocaleString()}/hr
                </div>
            )}

            {/* ── Low balance warning ── */}
            {lowBalance && phase === "in-call" && (
                <div className="call-room__warning">
                    <AlertTriangle size={14} />
                    Wallet balance low — this call will end in under a minute
                </div>
            )}

            {/* ── Controls ── */}
            <div className="call-room__controls">
                {phase === "in-call" && (
                    <button
                        className={`call-action-btn call-action-btn--toggle ${isMuted ? "call-action-btn--off" : ""}`}
                        onClick={toggleMute}
                        aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>
                )}

                <button
                    className="call-action-btn call-action-btn--decline call-action-btn--lg"
                    onClick={() => void hangUp()}
                    aria-label={isRinging ? "Cancel" : "End call"}
                >
                    <PhoneOff size={24} />
                </button>

                {phase === "in-call" && isVideo && (
                    <button
                        className={`call-action-btn call-action-btn--toggle ${isCameraOff ? "call-action-btn--off" : ""}`}
                        onClick={toggleCamera}
                        aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
                    >
                        {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>
                )}
            </div>
        </div>
    )
}