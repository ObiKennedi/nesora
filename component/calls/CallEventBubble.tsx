// component/calls/CallEventBubble.tsx
"use client"

// Renders CALL_EVENT messages inside both chat threads (fan + creator).
// Display-only, centered chip — WhatsApp-style. The content string is
// written server-side by callEventContent() in lib/calls.ts:
//   "Missed voice call" · "Declined video call" · "Voice call · 12 min · ₦400"

import { Phone, Video, PhoneMissed } from "lucide-react"
import { format } from "date-fns"
import "@/styles/calls/CallEventBubble.scss"

type Props = {
    content:   string
    createdAt: Date | string
}

export const CallEventBubble = ({ content, createdAt }: Props) => {
    const isVideo  = content.toLowerCase().includes("video")
    const isMissed = content.startsWith("Missed") || content.startsWith("Declined")

    const Icon = isMissed ? PhoneMissed : isVideo ? Video : Phone

    return (
        <div className="call-event">
            <div className={`call-event__chip ${isMissed ? "call-event__chip--missed" : ""}`}>
                <Icon size={13} />
                <span>{content}</span>
                <span className="call-event__time">
                    {format(new Date(createdAt), "h:mm a")}
                </span>
            </div>
        </div>
    )
}