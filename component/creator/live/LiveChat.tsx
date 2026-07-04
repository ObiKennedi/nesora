"use client"

import { useEffect, useRef, useState } from "react"
import { getPusherClient } from "@/lib/pusher-client"
import { getLiveMessagesAction, sendLiveMessageAction } from "@/actions/live/chat"

interface ChatMessage {
    id: string
    content: string
    createdAt: string | Date
    user: { id: string; username: string | null; firstName: string | null; image: string | null }
}

interface LiveChatProps {
    streamId: string
    currentUserId: string
    canSend?: boolean
}

export default function LiveChat({ streamId, currentUserId, canSend = true }: LiveChatProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [draft, setDraft]       = useState("")
    const [sending, setSending]   = useState(false)
    const listRef = useRef<HTMLDivElement | null>(null)

    // Initial load.
    useEffect(() => {
        getLiveMessagesAction(streamId).then((m) => setMessages(m as ChatMessage[]))
    }, [streamId])

    // Live updates.
    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`stream-${streamId}`)
        channel.bind("chat-message", (msg: ChatMessage) => {
            setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        })
        return () => {
            channel.unbind("chat-message")
            pusher.unsubscribe(`stream-${streamId}`)
        }
    }, [streamId])

    // Auto-scroll to newest.
    useEffect(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    }, [messages])

    async function send() {
        const content = draft.trim()
        if (!content || sending) return
        setSending(true)
        setDraft("")
        const res = await sendLiveMessageAction({ streamId, content })
        setSending(false)
        if ("error" in res) setDraft(content) // restore on failure
    }

    return (
        <div className="live-chat">
            <div className="live-chat__header">Live chat</div>
            <div className="live-chat__messages" ref={listRef}>
                {messages.length === 0 && <p className="live-chat__empty">No messages yet. Say hello 👋</p>}
                {messages.map((m) => {
                    const name = m.user.firstName || m.user.username || "Guest"
                    const mine = m.user.id === currentUserId
                    return (
                        <div key={m.id} className={`live-chat__msg ${mine ? "is-mine" : ""}`}>
                            {m.user.image
                                ? <img className="live-chat__avatar" src={m.user.image} alt={name} />
                                : <span className="live-chat__avatar live-chat__avatar--fallback">{name[0]}</span>}
                            <span className="live-chat__body">
                                <span className="live-chat__name">{name}</span>
                                <span className="live-chat__text">{m.content}</span>
                            </span>
                        </div>
                    )
                })}
            </div>
            {canSend && (
                <div className="live-chat__composer">
                    <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") send() }}
                        placeholder="Send a message…"
                        maxLength={300}
                    />
                    <button onClick={send} disabled={sending || !draft.trim()}>Send</button>
                </div>
            )}
        </div>
    )
}