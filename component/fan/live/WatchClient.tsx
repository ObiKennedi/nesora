// components/fan/live/WatchClient.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BadgeCheck, Gift, Lock } from "lucide-react"
import { getPusherClient }         from "@/lib/pusher-client"
import { getStreamForWatchAction } from "@/actions/fan/live"
import StreamPlayer    from "@/component/fan/live/StreamPlayer"
import LiveChat        from "@/component/creator/live/LiveChat"
import LiveGiftWallet  from "@/component/creator/live/LiveGiftWallet"
import { GiftPanel }   from "@/component/fan/feed/GiftPanel"
import "@/styles/creator/live.scss"
import "@/styles/fan/Watch.scss"

type WatchData = Extract<Awaited<ReturnType<typeof getStreamForWatchAction>>, { success: true }>
type Status    = "SCHEDULED" | "LIVE" | "ENDED"

export default function WatchClient({
    data,
    currentUserId,
}: {
    data:          WatchData
    currentUserId: string
}) {
    const { stream, creator, locked, subscribePrice } = data

    const [status,   setStatus]   = useState<Status>(stream.status as Status)
    const [showGift, setShowGift] = useState(false)

    // ── React to go-live / end events ────────────────────────────────────────
    // `creator-${id}-live` isn't shared with another component on this page,
    // so unsubscribing on cleanup is safe.
    useEffect(() => {
        const pusher  = getPusherClient()
        const name    = `creator-${creator.id}-live`
        const channel = pusher.subscribe(name)

        channel.bind("stream-live",  () => setStatus("LIVE"))
        channel.bind("stream-ended", () => setStatus("ENDED"))

        return () => {
            channel.unbind_all()
            pusher.unsubscribe(name)
        }
    }, [creator.id])

    // ── Locked (subscriber-only, not subscribed) ─────────────────────────────
    if (locked) {
        return (
            <div className="watch watch--locked">
                <div className="watch__lock">
                    <Lock size={30} />
                    <h2>Subscribers only</h2>
                    <p>{creator.displayName} is live for subscribers. Subscribe to watch.</p>
                    <Link
                        href={`/fan/${creator.handle ?? creator.id}`}
                        className="watch__subscribe"
                    >
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
                            {/* StreamPlayer owns the whole playback lifecycle:
                                IVS SDK loading, Safari native-HLS fallback,
                                muted autoplay + tap-for-sound, and offline
                                retry while the broadcaster's first segments
                                are still landing. Remounts cleanly if the
                                stream ends (status leaves "LIVE"). */}
                            <StreamPlayer
                                playbackUrl={stream.playbackUrl}
                                streamStatus={status}
                            />
                            <span className="watch__live-badge">● LIVE</span>
                        </>
                    ) : status === "ENDED" && stream.recordingUrl ? (
                        /* IVS recordings in S3 are HLS (.m3u8) too — a bare
                           <video src> replay is a black box everywhere except
                           Safari. Replays go through the same player, with
                           native controls for scrubbing. */
                        <StreamPlayer
                            playbackUrl={stream.recordingUrl}
                            streamStatus="ENDED"
                            controls
                        />
                    ) : (
                        <div className="watch__placeholder">
                            {status === "SCHEDULED"
                                ? "Stream is starting soon…"
                                : "This stream has ended."}
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

                        <button
                            className="watch__gift"
                            onClick={() => setShowGift(true)}
                            disabled={status === "ENDED"}
                        >
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
                    onSent={()  => setShowGift(false)}
                />
            )}
        </div>
    )
}