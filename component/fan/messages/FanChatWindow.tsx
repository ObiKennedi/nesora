// components/fan/messages/FanChatWindow.tsx
"use client"

import {
    useState, useEffect, useRef,
    useTransition, useCallback,
} from "react"
import Image from "next/image"
import {
    Send, Mic, ImagePlus,
    Loader2, CheckCheck, Check,
    ArrowLeft,
} from "lucide-react"
import {
    getFanMessagesAction,
    sendFanMessageAction,
    sendFanTypingAction,
} from "@/actions/fan/messages"
import { getPusherClient }   from "@/lib/pusher-client"
import { format, isToday, isYesterday } from "date-fns"
import { CallHeaderButtons } from "@/component/calls/CallHeaderButtons"
import { CallEventBubble }   from "@/component/calls/CallEventBubble"
import VoiceRecorder from "@/component/messages/VoiceRecorder"
import type { VoiceNoteUpload } from "@/lib/upload-voice-note"
import "@/styles/fan/messages/FanChatWindow.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type Message = {
    id:            string
    type:          string
    content:       string | null
    mediaUrl:      string | null
    voiceNoteUrl:  string | null
    voiceDuration: number | null
    callId:        string | null
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
    id:      string
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
}

type Props = {
    conversation:  Conversation
    currentUserId: string
    onMessageSent: () => void
    onBack?:       () => void   // mobile back arrow
}

// ── Cloudinary upload ─────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export const FanChatWindow = ({
    conversation,
    currentUserId,
    onMessageSent,
    onBack,
}: Props) => {

    const [messages,    setMessages]     = useState<Message[]>([])
    const [text,        setText]         = useState("")
    const [uploading,   setUploading]    = useState(false)
    const [voiceActive, setVoiceActive]  = useState(false) // recorder is recording/previewing/uploading
    const [isTyping,    setIsTyping]     = useState(false)
    const [page,        setPage]         = useState(1)
    const [hasMore,     setHasMore]      = useState(false)
    const [isPending,   startTransition] = useTransition()
    const [isSending,   startSend]       = useTransition()

    const bottomRef   = useRef<HTMLDivElement>(null)
    const fileRef     = useRef<HTMLInputElement>(null)
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const creatorName  = conversation.creator.displayName
    const creatorImage = conversation.creator.user.image

    // ── Fetch messages ────────────────────────────────────────────────────────
    const fetchMessages = useCallback(() => {
        startTransition(async () => {
            const res = await getFanMessagesAction(conversation.id, { page, limit: 30 })
            if ("error" in res) return
            setMessages(res.messages as Message[])
            setHasMore(res.pages > 1)
        })
    }, [conversation.id, page])

    useEffect(() => { fetchMessages() }, [fetchMessages])

    // Scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // ── Pusher ────────────────────────────────────────────────────────────────
    // NOTE: named handlers + unbind(event, handler) ONLY. Never unbind_all()
    // or pusher.unsubscribe() here — the conversation channel is shared with
    // sibling components (ChatDock, unread badges) and nuking it kills theirs.
    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`private-conversation-${conversation.id}`)

        const handleNewMessage = (data: { message: Message }) => {
            setMessages((prev) => {
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
        sendFanTypingAction(conversation.id, true)

        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => {
            sendFanTypingAction(conversation.id, false)
        }, 2000)
    }

    // ── Send text ─────────────────────────────────────────────────────────────
    const handleSendText = () => {
        if (!text.trim()) return
        const content = text.trim()
        setText("")

        startSend(async () => {
            const res = await sendFanMessageAction({
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
            const isImage = file.type.startsWith("image/")
            const folder  = isImage ? "messages/media" : "messages/videos"
            const url     = await uploadToCloudinary(file, folder)

            await sendFanMessageAction({
                conversationId: conversation.id,
                type:           isImage ? "IMAGE" : "VIDEO",
                mediaUrl:       url,
            })
            onMessageSent()
        } catch {
            // silently handle
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    // ── Voice note ────────────────────────────────────────────────────────────
    // Recording, preview, and Cloudinary upload all live inside VoiceRecorder.
    // This fires only once the upload has fully resolved with a real asset.
    const handleSendVoiceNote = async (upload: VoiceNoteUpload) => {
        const res = await sendFanMessageAction({
            conversationId:    conversation.id,
            type:              "VOICE_NOTE",
            voiceNoteUrl:      upload.url,
            voiceNotePublicId: upload.publicId,
            voiceDuration:     upload.duration,
        })
        if (res?.error) throw new Error(res.error) // recorder keeps the take for retry
        onMessageSent()
    }

    // ── Date helper ───────────────────────────────────────────────────────────
    const getDateLabel = (date: Date) => {
        if (isToday(date))     return "Today"
        if (isYesterday(date)) return "Yesterday"
        return format(date, "d MMM yyyy")
    }

    let lastDate = ""

    return (
        <div className="fan-chat">

            {/* ── Header ── */}
            <div className="fan-chat__header">
                {onBack && (
                    <button
                        className="fan-chat__back"
                        onClick={onBack}
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                <div className="fan-chat__avatar">
                    {creatorImage ? (
                        <Image
                            src={creatorImage}
                            alt={creatorName}
                            width={36}
                            height={36}
                        />
                    ) : (
                        <span>{creatorName.charAt(0).toUpperCase()}</span>
                    )}
                </div>

                <div className="fan-chat__header-info">
                    <p className="fan-chat__name">{creatorName}</p>
                    {conversation.creator.handle && (
                        <p className="fan-chat__handle">
                            @{conversation.creator.handle}
                        </p>
                    )}
                </div>

                {/* Sibling of header-info — .call-header-btns right-aligns
                    itself via margin-left: auto */}
                <CallHeaderButtons
                    conversationId={conversation.id}
                    counterpart={{ name: creatorName, image: creatorImage }}
                />
            </div>

            {/* ── Messages ── */}
            <div className="fan-chat__messages">
                {isPending ? (
                    <div className="fan-chat__loading">
                        <Loader2 size={20} className="spin" />
                    </div>
                ) : (
                    <>
                        {hasMore && (
                            <button
                                className="fan-chat__load-more"
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
                                        <div className="fan-chat__date-sep">
                                            <span>{dateLabel}</span>
                                        </div>
                                    )}

                                    {msg.type === "CALL_EVENT" ? (
                                        /* Call events render as a centered chip,
                                           outside the mine/theirs bubble layout */
                                        <CallEventBubble
                                            content={msg.content ?? "Call"}
                                            createdAt={msg.createdAt}
                                        />
                                    ) : (
                                        <div className={`fan-msg ${isMine ? "fan-msg--mine" : "fan-msg--theirs"}`}>
                                            {/* Sender avatar (theirs only) */}
                                            {!isMine && (
                                                <div className="fan-msg__avatar">
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
                                            <div className="fan-msg__bubble">
                                                {msg.type === "TEXT" && (
                                                    <p>{msg.content}</p>
                                                )}
                                                {msg.type === "IMAGE" && msg.mediaUrl && (
                                                    <img
                                                        src={msg.mediaUrl}
                                                        alt="Shared image"
                                                        className="fan-msg__image"
                                                    />
                                                )}
                                                {msg.type === "VIDEO" && msg.mediaUrl && (
                                                    <video
                                                        src={msg.mediaUrl}
                                                        controls
                                                        className="fan-msg__video"
                                                    />
                                                )}
                                                {msg.type === "VOICE_NOTE" && msg.voiceNoteUrl && (
                                                    <div className="fan-msg__voice">
                                                        <Mic size={14} />
                                                        <audio src={msg.voiceNoteUrl} controls preload="metadata" />
                                                        {msg.voiceDuration ? (
                                                            <span className="fan-msg__voice-duration">
                                                                {formatVoiceDuration(msg.voiceDuration)}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                )}

                                                {/* Meta */}
                                                <div className="fan-msg__meta">
                                                    <span className="fan-msg__time">
                                                        {format(new Date(msg.createdAt), "h:mm a")}
                                                    </span>
                                                    {isMine && (
                                                        <span className="fan-msg__read">
                                                            {msg.isRead
                                                                ? <CheckCheck size={12} className="read--done" />
                                                                : <Check      size={12} />
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {/* Typing indicator */}
                        {isTyping && (
                            <div className="fan-chat__typing">
                                <div className="fan-chat__typing-dots">
                                    <span /><span /><span />
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </>
                )}
            </div>

            {/* ── Input ── */}
            <div className="fan-chat__input">
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
                        <button
                            className="fan-chat__input-btn"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading || isSending}
                            title="Send photo or video"
                        >
                            {uploading
                                ? <Loader2 size={18} className="spin" />
                                : <ImagePlus size={18} />
                            }
                        </button>

                        <textarea
                            className="fan-chat__input-text"
                            placeholder="Type a message..."
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
                        className="fan-chat__send-btn"
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