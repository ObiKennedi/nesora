// component/live/StreamPlayer.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, VolumeX, WifiOff } from "lucide-react"
import "@/styles/fan/stream-player.scss"

const IVS_PLAYER_CDN  = "https://player.live-video.net/1.24.0/amazon-ivs-player.min.js"
const OFFLINE_RETRY_MS = 8000

type PlayerPhase = "loading" | "playing" | "offline" | "error"

type StreamPlayerProps = {
    playbackUrl: string
    streamStatus: "SCHEDULED" | "LIVE" | "ENDED"
    poster?: string | null
    controls?: boolean
}
declare global {
    interface Window {
        IVSPlayer?: {
            isPlayerSupported: boolean
            create: () => IvsPlayerInstance
            PlayerState: Record<string, string>
            PlayerEventType: Record<string, string>
        }
    }
}

type IvsPlayerInstance = {
    attachHTMLVideoElement: (el: HTMLVideoElement) => void
    load: (url: string) => void
    play: () => void
    pause: () => void
    setAutoplay: (on: boolean) => void
    setMuted: (muted: boolean) => void
    setVolume: (v: number) => void
    addEventListener: (event: string, cb: (payload?: unknown) => void) => void
    removeEventListener: (event: string, cb: (payload?: unknown) => void) => void
    delete: () => void
}

let sdkPromise: Promise<void> | null = null

function loadIvsSdk(): Promise<void> {
    if (typeof window === "undefined") return Promise.reject()
    if (window.IVSPlayer) return Promise.resolve()

    if (!sdkPromise) {
        sdkPromise = new Promise<void>((resolve, reject) => {
            const script = document.createElement("script")
            script.src     = IVS_PLAYER_CDN
            script.async   = true
            script.onload  = () => resolve()
            script.onerror = () => {
                sdkPromise = null // allow retry on next mount
                reject(new Error("Failed to load the video player."))
            }
            document.head.appendChild(script)
        })
    }
    return sdkPromise
}

export default function StreamPlayer({
    playbackUrl,
    streamStatus,
    poster,
    controls,
}: StreamPlayerProps) {
    const [phase, setPhase] = useState<PlayerPhase>("loading")
    const [muted, setMuted] = useState(true)

    const videoRef  = useRef<HTMLVideoElement>(null)
    const playerRef = useRef<IvsPlayerInstance | null>(null)
    const retryRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearRetry = useCallback(() => {
        if (retryRef.current) {
            clearTimeout(retryRef.current)
            retryRef.current = null
        }
    }, [])

    useEffect(() => {
        const videoEl = videoRef.current
        if (!videoEl || !playbackUrl) return

        let disposed = false

        const setup = async () => {
            try {
                await loadIvsSdk()
            } catch {
                if (!disposed) setPhase("error")
                return
            }
            if (disposed) return

            const IVS = window.IVSPlayer!

            // Safari (esp. iOS) may not support MSE — but it plays HLS natively,
            // so fall back to a plain video element there.
            if (!IVS.isPlayerSupported) {
                videoEl.src         = playbackUrl
                videoEl.muted       = true
                videoEl.playsInline = true
                videoEl
                    .play()
                    .then(() => setPhase("playing"))
                    .catch(() => setPhase("offline"))
                return
            }

            const player = IVS.create()
            playerRef.current = player
            player.attachHTMLVideoElement(videoEl)

            const { PlayerState, PlayerEventType } = IVS

            player.addEventListener(PlayerState.PLAYING, () => {
                clearRetry()
                setPhase("playing")
            })

            player.addEventListener(PlayerState.ENDED, () => {
                setPhase(streamStatus === "LIVE" ? "offline" : "error")
            })

            player.addEventListener(PlayerEventType.ERROR, () => {
                // Most common: channel is offline (viewer arrived before the
                // broadcaster's first segment, or broadcaster dropped).
                // While the stream is marked LIVE, keep retrying.
                setPhase("offline")
                if (streamStatus === "LIVE" && !retryRef.current) {
                    retryRef.current = setTimeout(() => {
                        retryRef.current = null
                        if (!disposed && playerRef.current) {
                            playerRef.current.load(playbackUrl)
                            playerRef.current.play()
                        }
                    }, OFFLINE_RETRY_MS)
                }
            })

            // Muted autoplay — unmuted autoplay is blocked by every browser
            player.setAutoplay(true)
            player.setMuted(true)
            player.load(playbackUrl)
            player.play()
        }

        void setup()

        return () => {
            disposed = true
            clearRetry()
            playerRef.current?.delete()
            playerRef.current = null
            videoEl.removeAttribute("src")
        }
    }, [playbackUrl, streamStatus, clearRetry])

    const handleUnmute = () => {
        playerRef.current?.setMuted(false)
        playerRef.current?.setVolume(1)
        if (videoRef.current) videoRef.current.muted = false
        setMuted(false)
    }

    return (
        <div className="stream-player">
            <video
                ref={videoRef}
                className="stream-player__video"
                playsInline
                muted
                poster={poster ?? undefined}
                controls={controls}
            />

            {phase === "loading" && (
                <div className="stream-player__overlay">
                    <Loader2 size={28} className="stream-player__spinner" />
                </div>
            )}

            {phase === "offline" && (
                <div className="stream-player__overlay">
                    <WifiOff size={28} />
                    <p className="stream-player__overlay-title">Waiting for the stream…</p>
                    <p className="stream-player__overlay-hint">
                        {streamStatus === "LIVE"
                            ? "The broadcast signal dropped — reconnecting automatically."
                            : "This stream hasn't started yet."}
                    </p>
                </div>
            )}

            {phase === "error" && (
                <div className="stream-player__overlay">
                    <p className="stream-player__overlay-title">This stream has ended</p>
                    <p className="stream-player__overlay-hint">
                        Check back for the replay or the creator's next live.
                    </p>
                </div>
            )}

            {phase === "playing" && muted && !controls && (
                <button
                    type="button"
                    className="stream-player__unmute"
                    onClick={handleUnmute}
                >
                    <VolumeX size={16} />
                    <span>Tap for sound</span>
                </button>
            )}
        </div>
    )
}