"use client"

import {
    useState, useEffect, useRef,
    useTransition, useCallback,
} from "react"
import Image from "next/image"
import {
    Send, Mic, ImagePlus, X,
    Loader2, CheckCheck, Check,
    StopCircle, ArrowLeft,
} from "lucide-react"
import {
    getFanMessagesAction,
    sendFanMessageAction,
    sendFanTypingAction,
} from "@/actions/fan/messages"
import { getPusherClient } from "@/lib/pusher-client"
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns"
import "@/styles/fan/messages/FanChatWindow.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export const FanChatWindow = ({
    conversation,
    currentUserId,
    onMessageSent,
    onBack,
}: Props) => {

    const [messages,     setMessages]     = useState<Message[]>([])
    const [text,         setText]         = useState("")
    const [uploading,    setUploading]    = useState(false)
    const [recording,    setRecording]    = useState(false)
    const [isTyping,     setIsTyping]     = useState(false)
    const [page,         setPage]         = useState(1)
    const [hasMore,      setHasMore]      = useState(false)
    const [isPending,    startTransition] = useTransition()
    const [isSending,    startSend]       = useTransition()

    const bottomRef   = useRef<HTMLDivElement>(null)
    const fileRef     = useRef<HTMLInputElement>(null)
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const mediaRef    = useRef<MediaRecorder | null>(null)
    const chunksRef   = useRef<Blob[]>([])

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
    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`private-conversation-${conversation.id}`)

        channel.bind("new-message", (data: { message: Message }) => {
            setMessages((prev) => {
                if (prev.find((m) => m.id === data.message.id)) return prev
                return [...prev, data.message]
            })
        })

        channel.bind("typing", (data: { userId: string; isTyping: boolean }) => {
            if (data.userId !== currentUserId) {
                setIsTyping(data.isTyping)
            }
        })

        channel.bind("messages-read", () => {
            setMessages((prev) =>
                prev.map((m) =>
                    m.senderId === currentUserId
                        ? { ...m, isRead: true }
                        : m
                )
            )
        })

        return () => {
            channel.unbind_all()
            pusher.unsubscribe(`private-conversation-${conversation.id}`)
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
    const startRecording = async () => {
        try {
            const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
            const recorder = new MediaRecorder(stream)
            chunksRef.current = []

            recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
            recorder.onstop = async () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" })
                const file = new File([blob], "voice-note.webm", { type: "audio/webm" })

                setUploading(true)
                try {
                    const url = await uploadToCloudinary(file, "messages/voice-notes")
                    await sendFanMessageAction({
                        conversationId: conversation.id,
                        type:           "VOICE_NOTE",
                        voiceNoteUrl:   url,
                    })
                    onMessageSent()
                } finally {
                    setUploading(false)
                    stream.getTracks().forEach((t) => t.stop())
                }
            }

            recorder.start()
            mediaRef.current = recorder
            setRecording(true)
        } catch {
            alert("Microphone access denied.")
        }
    }

    const stopRecording = () => {
        mediaRef.current?.stop()
        setRecording(false)
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
                                                    <audio src={msg.voiceNoteUrl} controls />
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

                <button
                    className="fan-chat__input-btn"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading || isSending || recording}
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
                    disabled={uploading || isSending || recording}
                />

                <button
                    className={`fan-chat__input-btn ${recording ? "fan-chat__input-btn--recording" : ""}`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    disabled={uploading || isSending}
                    title="Hold to record voice note"
                >
                    {recording
                        ? <StopCircle size={18} />
                        : <Mic        size={18} />
                    }
                </button>

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
            </div>
        </div>
    )
}
