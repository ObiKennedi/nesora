// components/creator/messages/ChatWindow.tsx
"use client"

import {
    useState, useEffect, useRef,
    useTransition, useCallback,
} from "react"
import Image from "next/image"
import {
    Send, Mic, ImagePlus,
    Loader2, CheckCheck, Check,
} from "lucide-react"
import {
    getMessagesAction,
    sendMessageAction,
    sendTypingAction,
} from "@/actions/creator/messages"
import { getPusherClient } from "@/lib/pusher-client"
import { format, isToday, isYesterday } from "date-fns"
import VoiceRecorder from "@/component/messages/VoiceRecorder"
import type { VoiceNoteUpload } from "@/lib/upload-voice-note"
import "@/styles/creator/messages/ChatWindow.scss"

type Message = {
    id:            string
    type:          string
    content:       string | null
    mediaUrl:      string | null
    voiceNoteUrl:  string | null
    voiceDuration: number | null
    isRead:        boolean
    readAt:        Date   | null
    createdAt:     Date
    senderId:      string
    sender: {
        id:        string
        username:  string | null
        firstName: string | null
        image:     string | null
    }
}

type Conversation = {
    id:          string
    subscriber: {
        id:        string
        username:  string | null
        firstName: string | null
        lastName:  string | null
        image:     string | null
    }
}

type Props = {
    conversation:  Conversation
    currentUserId: string
    onMessageSent: () => void
}

const uploadToCloudinary = async (file: File, folder: string) => {
    const form = new FormData()
    form.append("file",          file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        `nesora/${folder}`)

    const resourceType = file.type.startsWith("image/") ? "image"
        : file.type.startsWith("video/") ? "video"
        : "raw"

    const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message)
    return data.secure_url as string
}

const formatVoiceDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
}

export const ChatWindow = ({
    conversation,
    currentUserId,
    onMessageSent,
}: Props) => {

    const [messages,    setMessages]     = useState<Message[]>([])
    const [text,        setText]         = useState("")
    const [uploading,   setUploading]    = useState(false)
    const [voiceActive, setVoiceActive]  = useState(false) // recorder is recording/previewing/uploading
    const [isTyping,    setIsTyping]     = useState(false) // other person typing
    const [page,        setPage]         = useState(1)
    const [hasMore,     setHasMore]      = useState(false)
    const [isPending,   startTransition] = useTransition()
    const [isSending,   startSend]       = useTransition()

    const bottomRef   = useRef<HTMLDivElement>(null)
    const fileRef     = useRef<HTMLInputElement>(null)
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const name = [
        conversation.subscriber.firstName,
        conversation.subscriber.lastName,
    ].filter(Boolean).join(" ") || "Anonymous"

    // ── Fetch messages ────────────────────────────────────────────────────────
    const fetchMessages = useCallback(() => {
        startTransition(async () => {
            const res = await getMessagesAction(conversation.id, { page, limit: 30 })
            if ("error" in res) return
            setMessages(res.messages as Message[])
            setHasMore(res.pages > 1)
        })
    }, [conversation.id, page])

    useEffect(() => { fetchMessages() }, [fetchMessages])

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // ── Pusher: listen for real-time events ───────────────────────────────────
    // NOTE: named handlers + unbind(event, handler) ONLY. Never unbind_all()
    // or pusher.unsubscribe() here — the conversation channel is shared with
    // sibling components (ChatDock, unread badges) and nuking it kills theirs.
    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`private-conversation-${conversation.id}`)

        const handleNewMessage = (data: { message: Message }) => {
            setMessages((prev) => {
                // Avoid duplicates
                if (prev.find((m) => m.id === data.message.id)) return prev
                return [...prev, data.message]
            })
        }

        const handleTyping = (data: { userId: string; isTyping: boolean }) => {
            if (data.userId !== currentUserId) {
                setIsTyping(data.isTyping)
            }
        }

        const handleMessagesRead = () => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.senderId === currentUserId
                        ? { ...m, isRead: true }
                        : m
                )
            )
        }

        channel.bind("new-message",   handleNewMessage)
        channel.bind("typing",        handleTyping)
        channel.bind("messages-read", handleMessagesRead)

        return () => {
            channel.unbind("new-message",   handleNewMessage)
            channel.unbind("typing",        handleTyping)
            channel.unbind("messages-read", handleMessagesRead)
        }
    }, [conversation.id, currentUserId])

    // ── Typing indicator ──────────────────────────────────────────────────────
    const handleTextChange = (val: string) => {
        setText(val)
        sendTypingAction(conversation.id, true)

        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => {
            sendTypingAction(conversation.id, false)
        }, 2000)
    }

    // ── Send text ─────────────────────────────────────────────────────────────
    const handleSendText = () => {
        if (!text.trim()) return
        const content = text.trim()
        setText("")

        startSend(async () => {
            const res = await sendMessageAction({
                conversationId: conversation.id,
                type:           "TEXT",
                content,
            })
            if (res?.success) onMessageSent()
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSendText()
        }
    }

    // ── Media upload ──────────────────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const isImage  = file.type.startsWith("image/")
            const folder   = isImage ? "messages/media" : "messages/videos"
            const url      = await uploadToCloudinary(file, folder)

            await sendMessageAction({
                conversationId: conversation.id,
                type:           isImage ? "IMAGE" : "VIDEO",
                mediaUrl:       url,
            })
            onMessageSent()
        } catch {
            // handle error
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    // ── Voice note ────────────────────────────────────────────────────────────
    // Recording, preview, and Cloudinary upload all live inside VoiceRecorder.
    // This fires only once the upload has fully resolved with a real asset.
    const handleSendVoiceNote = async (upload: VoiceNoteUpload) => {
        const res = await sendMessageAction({
            conversationId:    conversation.id,
            type:              "VOICE_NOTE",
            voiceNoteUrl:      upload.url,
            voiceNotePublicId: upload.publicId,
            voiceDuration:     upload.duration,
        })
        if (res?.error) throw new Error(res.error) // recorder keeps the take for retry
        onMessageSent()
    }

    // ── Date separator helper ─────────────────────────────────────────────────
    const getDateLabel = (date: Date) => {
        if (isToday(date))     return "Today"
        if (isYesterday(date)) return "Yesterday"
        return format(date, "d MMM yyyy")
    }

    // Group messages by date
    let lastDate = ""

    return (
        <div className="chat-window">

            {/* ── Header ── */}
            <div className="chat-window__header">
                <div className="chat-window__avatar">
                    {conversation.subscriber.image ? (
                        <Image
                            src={conversation.subscriber.image}
                            alt={name}
                            width={36}
                            height={36}
                        />
                    ) : (
                        <span>{name.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <div>
                    <p className="chat-window__name">{name}</p>
                    {conversation.subscriber.username && (
                        <p className="chat-window__handle">
                            @{conversation.subscriber.username}
                        </p>
                    )}
                </div>
            </div>

            {/* ── Messages ── */}
            <div className="chat-window__messages">
                {isPending ? (
                    <div className="chat-window__loading">
                        <Loader2 size={20} className="spin" />
                    </div>
                ) : (
                    <>
                        {hasMore && (
                            <button
                                className="chat-window__load-more"
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Load older messages
                            </button>
                        )}

                        {messages.map((msg) => {
                            const isMine    = msg.senderId === currentUserId
                            const dateLabel = getDateLabel(new Date(msg.createdAt))
                            const showDate  = dateLabel !== lastDate
                            lastDate        = dateLabel

                            return (
                                <div key={msg.id}>
                                    {showDate && (
                                        <div className="chat-date-sep">
                                            <span>{dateLabel}</span>
                                        </div>
                                    )}

                                    <div className={`chat-msg ${isMine ? "chat-msg--mine" : "chat-msg--theirs"}`}>

                                        {/* Sender avatar (theirs only) */}
                                        {!isMine && (
                                            <div className="chat-msg__avatar">
                                                {msg.sender.image ? (
                                                    <Image
                                                        src={msg.sender.image}
                                                        alt=""
                                                        width={28}
                                                        height={28}
                                                    />
                                                ) : (
                                                    <span>
                                                        {(msg.sender.firstName ?? "?").charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Bubble */}
                                        <div className="chat-msg__bubble">
                                            {msg.type === "TEXT" && (
                                                <p>{msg.content}</p>
                                            )}
                                            {(msg.type === "IMAGE") && msg.mediaUrl && (
                                                <img
                                                    src={msg.mediaUrl}
                                                    alt="Shared image"
                                                    className="chat-msg__image"
                                                />
                                            )}
                                            {msg.type === "VIDEO" && msg.mediaUrl && (
                                                <video
                                                    src={msg.mediaUrl}
                                                    controls
                                                    className="chat-msg__video"
                                                />
                                            )}
                                            {msg.type === "VOICE_NOTE" && msg.voiceNoteUrl && (
                                                <div className="chat-msg__voice">
                                                    <Mic size={14} />
                                                    <audio src={msg.voiceNoteUrl} controls preload="metadata" />
                                                    {msg.voiceDuration ? (
                                                        <span className="chat-msg__voice-duration">
                                                            {formatVoiceDuration(msg.voiceDuration)}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            )}

                                            {/* Meta */}
                                            <div className="chat-msg__meta">
                                                <span className="chat-msg__time">
                                                    {format(new Date(msg.createdAt), "h:mm a")}
                                                </span>
                                                {isMine && (
                                                    <span className="chat-msg__read">
                                                        {msg.isRead
                                                            ? <CheckCheck size={12} className="read--done" />
                                                            : <Check      size={12} />
                                                        }
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="chat-typing">
                                <div className="chat-typing__dots">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </>
                )}
            </div>

            {/* ── Input ── */}
            <div className="chat-window__input">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                />

                {/* While the recorder is active it fills the row; the rest of
                    the composer collapses out of the way */}
                {!voiceActive && (
                    <>
                        {/* Media button */}
                        <button
                            className="chat-input-btn"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading || isSending}
                            title="Send photo or video"
                        >
                            {uploading
                                ? <Loader2 size={18} className="spin" />
                                : <ImagePlus size={18} />
                            }
                        </button>

                        {/* Text input */}
                        <textarea
                            className="chat-input-text"
                            placeholder="Type a message…"
                            value={text}
                            onChange={(e) => handleTextChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={uploading || isSending}
                        />
                    </>
                )}

                {/* Voice note — tap to record, preview, tap send */}
                <VoiceRecorder
                    onSend={handleSendVoiceNote}
                    onActiveChange={setVoiceActive}
                    disabled={uploading || isSending}
                />

                {!voiceActive && (
                    <button
                        className="chat-send-btn"
                        onClick={handleSendText}
                        disabled={!text.trim() || isSending || uploading}
                    >
                        {isSending
                            ? <Loader2 size={16} className="spin" />
                            : <Send    size={16} />
                        }
                    </button>
                )}
            </div>

        </div>
    )
}