// components/creator/live/GoLiveClient.tsx
"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
    startStreamAction,
    endStreamAction,
    pollStreamStatusAction,
} from "@/actions/creator/stream"
import { getPusherClient } from "@/lib/pusher-client"
import BrowserBroadcaster  from "./BrowserBroadcaster"
import LiveChat            from "./LiveChat"
import LiveGiftWallet      from "./LiveGiftWallet"
import "@/styles/creator/live.scss"

type Phase  = "setup" | "broadcasting"
type Status = "SCHEDULED" | "LIVE" | "ENDED"
type Method = "browser" | "obs"

interface GoLiveClientProps {
    creatorId:     string
    currentUserId: string
}

// How long to wait for IVS to register the ingest before telling the creator
// something is wrong. IVS normally takes 5–15s; 90s means it isn't coming.
const POLL_TIMEOUT_MS  = 90_000
const POLL_INTERVAL_MS = 3_000

export default function GoLiveClient({ creatorId, currentUserId }: GoLiveClientProps) {
    const [phase,  setPhase]  = useState<Phase>("setup")
    const [status, setStatus] = useState<Status>("SCHEDULED")
    const [method, setMethod] = useState<Method>("browser")

    const [title,            setTitle]            = useState("")
    const [description,      setDescription]      = useState("")
    const [isSubscriberOnly, setIsSubscriberOnly] = useState(false)

    const [streamId,    setStreamId]    = useState<string | null>(null)
    const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
    const [broadcast,   setBroadcast]   = useState<{ ingestEndpoint: string; streamKey: string } | null>(null)

    // True once BrowserBroadcaster is actually pushing frames. Creating the
    // stream row is NOT the same as broadcasting — there's a second button.
    const [browserBroadcasting, setBrowserBroadcasting] = useState(false)

    const [keyRevealed, setKeyRevealed] = useState(false)
    const [loading,     setLoading]     = useState(false)
    const [error,       setError]       = useState<string | null>(null)
    const [copied,      setCopied]      = useState<"server" | "key" | null>(null)
    const [pollTimedOut, setPollTimedOut] = useState(false)

    const playerRef = useRef<any>(null)
    const videoRef  = useRef<HTMLVideoElement | null>(null)

    const serverUrl = broadcast ? `rtmps://${broadcast.ingestEndpoint}:443/app/` : ""

    // ── Create the stream row + fetch broadcast credentials ───────────────────
    async function handleGoLive() {
        setError(null)
        if (!title.trim()) { setError("Give your stream a title."); return }

        setLoading(true)
        const res = await startStreamAction({ title, description, isSubscriberOnly })
        setLoading(false)

        if ("error" in res) { setError(res.error ?? null); return }

        setStreamId(res.stream.id)
        setPlaybackUrl(res.stream.playbackUrl ?? null)
        setBroadcast(res.broadcast)
        setStatus("SCHEDULED")
        setPollTimedOut(false)
        setPhase("broadcasting")
    }

    async function handleEnd() {
        if (!streamId) return
        setLoading(true)
        const res = await endStreamAction(streamId)
        setLoading(false)
        if ("error" in res) { setError(res.error ?? null); return }
        setStatus("ENDED")
    }

    async function copy(text: string, which: "server" | "key") {
        await navigator.clipboard.writeText(text)
        setCopied(which)
        setTimeout(() => setCopied(null), 1500)
    }

    // ── Pusher: authoritative status changes ─────────────────────────────────
    // `creator-${id}-live` is not shared with any other component, so
    // unsubscribing on cleanup is safe here.
    useEffect(() => {
        if (phase !== "broadcasting") return

        const pusher  = getPusherClient()
        const name    = `creator-${creatorId}-live`
        const channel = pusher.subscribe(name)

        channel.bind("stream-live",  () => setStatus("LIVE"))
        channel.bind("stream-ended", () => setStatus("ENDED"))

        return () => {
            channel.unbind_all()
            pusher.unsubscribe(name)
        }
    }, [phase, creatorId])

    // ── Poll until IVS confirms ingest ───────────────────────────────────────
    //
    // Runs in ALL environments. The webhook can't reach localhost and can lag
    // or drop in production, so this — not EventBridge — is what actually
    // flips the row to LIVE. The webhook is reconciliation.
    //
    // Only polls once something is genuinely being ingested:
    //   browser → after "Start broadcast" is pressed
    //   obs     → immediately; we can't know when the encoder connects
    const shouldPoll =
        phase === "broadcasting" &&
        status === "SCHEDULED" &&
        !!streamId &&
        (method === "obs" || browserBroadcasting)

    useEffect(() => {
        if (!shouldPoll || !streamId) return

        let cancelled = false
        let timer: ReturnType<typeof setTimeout>
        const startedAt = Date.now()

        const tick = async () => {
            if (cancelled) return

            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                setPollTimedOut(true)
                return
            }

            try {
                const res = await pollStreamStatusAction(streamId)
                if (cancelled) return

                if ("error" in res) return   // stream vanished — stop

                setStatus(res.status)
                if (!res.pending) return     // resolved — stop
            } catch {
                // Network hiccup. Fall through and retry.
            }

            timer = setTimeout(tick, POLL_INTERVAL_MS)
        }

        tick()

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [shouldPoll, streamId])

    // Restart the timeout clock if the creator (re)starts their broadcast
    useEffect(() => {
        if (browserBroadcasting) setPollTimedOut(false)
    }, [browserBroadcasting])

    // ── OBS preview player ───────────────────────────────────────────────────
    useEffect(() => {
        if (method !== "obs") return
        if (status !== "LIVE" || !playbackUrl) return

        let cancelled = false

        async function initPlayer() {
            if (!(window as any).IVSPlayer) {
                await new Promise<void>((resolve, reject) => {
                    const s = document.createElement("script")
                    s.src = "https://player.live-video.net/1.x/amazon-ivs-player.min.js"
                    s.onload  = () => resolve()
                    s.onerror = () => reject(new Error("player load failed"))
                    document.body.appendChild(s)
                })
            }
            if (cancelled) return

            const IVSPlayer = (window as any).IVSPlayer
            if (!IVSPlayer?.isPlayerSupported || !videoRef.current) return

            const player = IVSPlayer.create()
            player.attachHTMLVideoElement(videoRef.current)
            player.load(playbackUrl!)
            player.setMuted(true)
            player.play()
            playerRef.current = player
        }

        initPlayer().catch(() => {})

        return () => {
            cancelled = true
            if (playerRef.current) { playerRef.current.delete(); playerRef.current = null }
        }
    }, [method, status, playbackUrl])

    const handleBroadcastingChange = useCallback((live: boolean) => {
        setBrowserBroadcasting(live)
    }, [])

    // ── Setup ────────────────────────────────────────────────────────────────
    if (phase === "setup") {
        return (
            <div className="go-live">
                <div className="go-live__card">
                    <h1 className="go-live__title">Go Live</h1>
                    <p className="go-live__subtitle">
                        Stream straight from your browser, or connect OBS.
                    </p>

                    {error && <div className="go-live__error">{error}</div>}

                    <div className="go-live__method">
                        <button
                            className={`go-live__method-btn ${method === "browser" ? "is-active" : ""}`}
                            onClick={() => setMethod("browser")}
                            type="button"
                        >
                            Stream from browser
                        </button>
                        <button
                            className={`go-live__method-btn ${method === "obs" ? "is-active" : ""}`}
                            onClick={() => setMethod("obs")}
                            type="button"
                        >
                            Use OBS
                        </button>
                    </div>

                    <label className="go-live__label">
                        Stream title
                        <input
                            className="go-live__input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="What are you streaming today?"
                            maxLength={120}
                        />
                    </label>

                    <label className="go-live__label">
                        Description <span className="go-live__optional">(optional)</span>
                        <textarea
                            className="go-live__input go-live__input--textarea"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            maxLength={500}
                        />
                    </label>

                    <label className="go-live__toggle">
                        <input
                            type="checkbox"
                            checked={isSubscriberOnly}
                            onChange={(e) => setIsSubscriberOnly(e.target.checked)}
                        />
                        <span>Subscribers only</span>
                    </label>

                    <button
                        className="go-live__btn go-live__btn--primary"
                        onClick={handleGoLive}
                        disabled={loading}
                    >
                        {loading ? "Setting up…" : "Go Live"}
                    </button>
                </div>
            </div>
        )
    }

    // ── Status pill copy ─────────────────────────────────────────────────────
    const statusLabel = (() => {
        if (status === "LIVE")  return "● You're live"
        if (status === "ENDED") return "Stream ended"

        if (pollTimedOut) {
            return method === "browser"
                ? "We can't detect your stream — try restarting the broadcast"
                : "We can't detect your encoder — check your OBS connection"
        }
        if (method === "browser") {
            return browserBroadcasting
                ? "Connecting to IVS…"
                : "Ready — start your broadcast below"
        }
        return "Waiting for your encoder…"
    })()

    return (
        <div className="go-live go-live--broadcasting">
            <div className="go-live__main">
                <div className="go-live__card">
                    <div className="go-live__status-row">
                        <span className={`go-live__pill go-live__pill--${status.toLowerCase()}`}>
                            {statusLabel}
                        </span>
                    </div>

                    {error && <div className="go-live__error">{error}</div>}

                    {pollTimedOut && status === "SCHEDULED" && (
                        <div className="go-live__error">
                            Your stream hasn&rsquo;t reached our servers after 90 seconds.
                            {method === "browser"
                                ? " Stop and start the broadcast again."
                                : " Confirm the server URL and stream key are pasted correctly in OBS."}
                        </div>
                    )}

                    {method === "browser" && status !== "ENDED" && broadcast && (
                        <BrowserBroadcaster
                            ingestEndpoint={broadcast.ingestEndpoint}
                            streamKey={broadcast.streamKey}
                            onError={setError}
                            onBroadcastingChange={handleBroadcastingChange}
                        />
                    )}

                    {method === "obs" && status !== "ENDED" && (
                        <>
                            <h2 className="go-live__section-title">Connect your encoder</h2>
                            <p className="go-live__hint">
                                In OBS: Settings → Stream → Service <strong>Custom</strong>, then paste these two values.
                            </p>

                            <div className="go-live__field">
                                <span className="go-live__field-label">Server</span>
                                <div className="go-live__copy-row">
                                    <code className="go-live__code">{serverUrl}</code>
                                    <button className="go-live__copy" onClick={() => copy(serverUrl, "server")}>
                                        {copied === "server" ? "Copied" : "Copy"}
                                    </button>
                                </div>
                            </div>

                            <div className="go-live__field">
                                <span className="go-live__field-label">Stream key</span>
                                <div className="go-live__copy-row">
                                    <code className="go-live__code">
                                        {keyRevealed ? broadcast?.streamKey : "•".repeat(28)}
                                    </code>
                                    <button className="go-live__copy" onClick={() => setKeyRevealed((v) => !v)}>
                                        {keyRevealed ? "Hide" : "Show"}
                                    </button>
                                    <button
                                        className="go-live__copy"
                                        onClick={() => broadcast && copy(broadcast.streamKey, "key")}
                                    >
                                        {copied === "key" ? "Copied" : "Copy"}
                                    </button>
                                </div>
                                <p className="go-live__warn">Treat your stream key like a password. Never share it.</p>
                            </div>

                            {status === "LIVE" && (
                                <div className="go-live__preview">
                                    <h2 className="go-live__section-title">Preview</h2>
                                    <video ref={videoRef} className="go-live__video" playsInline muted controls />
                                </div>
                            )}
                        </>
                    )}

                    {status !== "ENDED" ? (
                        <button
                            className="go-live__btn go-live__btn--danger"
                            onClick={handleEnd}
                            disabled={loading}
                        >
                            {loading ? "Ending…" : "End stream"}
                        </button>
                    ) : (
                        <a href="/creator/live" className="go-live__btn go-live__btn--primary">
                            Start a new stream
                        </a>
                    )}
                </div>
            </div>

            {/* Sidebar: chat + gift wallet, shown once the stream row exists */}
            {streamId && status !== "ENDED" && (
                <aside className="go-live__sidebar">
                    <LiveGiftWallet streamId={streamId} />
                    <LiveChat streamId={streamId} currentUserId={currentUserId} canSend />
                </aside>
            )}
        </div>
    )
}