"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BadgeCheck, Volume2, VolumeX, Gift, Lock } from "lucide-react"
import { getPusherClient } from "@/lib/pusher-client"
import { getStreamForWatchAction } from "@/actions/fan/live"
import LiveChat from "@/component/creator/live/LiveChat"
import LiveGiftWallet from "@/component/creator/live/LiveGiftWallet"
import { GiftPanel } from "@/component/fan/feed/GiftPanel"
import "@/styles/creator/live.scss"
import "@/styles/fan/Watch.scss"

type WatchData = Extract<Awaited<ReturnType<typeof getStreamForWatchAction>>, { success: true }>
type Status = "SCHEDULED" | "LIVE" | "ENDED"

export default function WatchClient({ data, currentUserId }: { data: WatchData; currentUserId: string }) {
    const { stream, creator, locked, isSubscribed, subscribePrice } = data

    const [status, setStatus] = useState<Status>(stream.status)
    const [muted, setMuted]   = useState(true)
    const [showGift, setShowGift] = useState(false)

    const videoRef  = useRef<HTMLVideoElement | null>(null)
    const playerRef = useRef<any>(null)

    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`creator-${creator.id}-live`)
        channel.bind("stream-live",  () => setStatus("LIVE"))
        channel.bind("stream-ended", () => setStatus("ENDED"))
        return () => { channel.unbind_all(); pusher.unsubscribe(`creator-${creator.id}-live`) }
    }, [creator.id])

    // Load + attach the IVS player once we're live and allowed.
    useEffect(() => {
        if (locked || status !== "LIVE" || !stream.playbackUrl) return
        let cancelled = false
        let player: any = null

        async function init() {
            if (!(window as any).IVSPlayer) {
                await new Promise<void>((res, rej) => {
                    const s = document.createElement("script")
                    s.src = "https://player.live-video.net/1.x/amazon-ivs-player.min.js"
                    s.onload = () => res(); s.onerror = () => rej(new Error("player load failed"))
                    document.body.appendChild(s)
                })
            }
            if (cancelled) return
            const IVSPlayer = (window as any).IVSPlayer
            if (!IVSPlayer?.isPlayerSupported || !videoRef.current) return
            player = IVSPlayer.create()
            player.attachHTMLVideoElement(videoRef.current)
            player.load(stream.playbackUrl)
            player.setMuted(true) // required for autoplay
            player.play()
            playerRef.current = player
        }
        init().catch(() => {})
        return () => { cancelled = true; if (player) player.delete(); playerRef.current = null }
    }, [locked, status, stream.playbackUrl])

    function toggleMute() {
        const p = playerRef.current
        if (!p) return
        const next = !muted
        p.setMuted(next)
        setMuted(next)
    }

    // ── Locked (subscriber-only, not subscribed) ─────────────────────────────
    if (locked) {
        return (
            <div className="watch watch--locked">
                <div className="watch__lock">
                    <Lock size={30} />
                    <h2>Subscribers only</h2>
                    <p>{creator.displayName} is live for subscribers. Subscribe to watch.</p>
                    <Link href={`/fan/${creator.handle ?? creator.id}`} className="watch__subscribe">
                        {subscribePrice ? `Subscribe · ₦${subscribePrice.toLocaleString()}` : "Subscribe"}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="watch">
            <div className="watch__main">
                <div className="watch__stage">
                    {status === "LIVE" && stream.playbackUrl ? (
                        <>
                            <video ref={videoRef} className="watch__video" playsInline />
                            <span className="watch__live-badge">● LIVE</span>
                            <button className="watch__mute" onClick={toggleMute}>
                                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                        </>
                    ) : (
                        <div className="watch__placeholder">
                            {status === "SCHEDULED" ? "Stream is starting soon…" : "This stream has ended."}
                        </div>
                    )}
                </div>

                <div className="watch__meta">
                    <div className="watch__creator">
                        {creator.image
                            ? <img className="watch__avatar" src={creator.image} alt={creator.displayName} />
                            : <span className="watch__avatar watch__avatar--fallback">{creator.displayName[0]}</span>}
                        <div>
                            <div className="watch__name">
                                {creator.displayName}
                                {creator.isVerified && <BadgeCheck size={14} className="watch__verified" />}
                            </div>
                            {creator.handle && <span className="watch__handle">@{creator.handle}</span>}
                        </div>
                        <button className="watch__gift" onClick={() => setShowGift(true)}>
                            <Gift size={16} /> Send gift
                        </button>
                    </div>
                    <h1 className="watch__title">{stream.title}</h1>
                    {stream.description && <p className="watch__desc">{stream.description}</p>}
                </div>
            </div>

            {status !== "ENDED" && (
                <aside className="watch__sidebar">
                    <LiveGiftWallet streamId={stream.id} />
                    <LiveChat streamId={stream.id} currentUserId={currentUserId} canSend />
                </aside>
            )}

            {showGift && (
                <GiftPanel
                    creatorId={creator.id}
                    liveStreamId={stream.id}
                    onClose={() => setShowGift(false)}
                    onSent={() => setShowGift(false)}
                />
            )}
        </div>
    )
}