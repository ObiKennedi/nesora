// components/creator/live/LiveGiftWallet.tsx
"use client"

import { useEffect, useState } from "react"
import { getPusherClient } from "@/lib/pusher-client"
import { getStreamGiftTotalAction } from "@/actions/live/chat"

interface GiftEvent {
    amount:     number
    giftName:   string
    senderName: string
}

interface LiveGiftWalletProps {
    streamId: string
}

const naira = (n: number) => `₦${n.toLocaleString()}`

export default function LiveGiftWallet({ streamId }: LiveGiftWalletProps) {
    const [total,  setTotal]  = useState(0)
    const [count,  setCount]  = useState(0)
    const [recent, setRecent] = useState<GiftEvent[]>([])

    useEffect(() => {
        getStreamGiftTotalAction(streamId).then(({ total, count }) => {
            setTotal(total)
            setCount(count)
        })
    }, [streamId])

    // Fires when a fan sends a gift (the fan-side gift action triggers this).
    //
    // `stream-${streamId}` is SHARED with LiveChat. Unbind this handler on
    // cleanup, but never unsubscribe — that would kill chat's binding too.
    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`stream-${streamId}`)

        const onGiftSent = (g: GiftEvent) => {
            setTotal((t) => t + g.amount)
            setCount((c) => c + 1)
            setRecent((prev) => [g, ...prev].slice(0, 5))
        }

        channel.bind("gift-sent", onGiftSent)

        return () => {
            channel.unbind("gift-sent", onGiftSent)
            // NOTE: no pusher.unsubscribe — LiveChat is on this channel too.
        }
    }, [streamId])

    return (
        <div className="gift-wallet">
            <div className="gift-wallet__total">
                <span className="gift-wallet__label">Gifted this stream</span>
                <span className="gift-wallet__amount">{naira(total)}</span>
                <span className="gift-wallet__count">{count} gift{count !== 1 ? "s" : ""}</span>
            </div>

            {recent.length > 0 && (
                <ul className="gift-wallet__feed">
                    {recent.map((g, i) => (
                        <li key={i} className="gift-wallet__item">
                            <strong>{g.senderName}</strong> sent {g.giftName}
                            <span className="gift-wallet__item-amt">{naira(g.amount)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}