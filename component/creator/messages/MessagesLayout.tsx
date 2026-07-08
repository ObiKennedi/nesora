// components/creator/messages/MessagesLayout.tsx
"use client"

import {
    useState,
    useEffect,
    useTransition,
    useCallback,
    SetStateAction
} from "react"
import {
    MessageCircle,
    Loader2,
    Users,
    Star,
    Inbox
} from "lucide-react"
import { getConversationsAction } from "@/actions/creator/messages"
import { ConversationList } from "./ConversationList"
import { ChatWindow } from "./ChatWindow"
import { MessageRequests } from "./MessageRequests"
import { getPusherClient } from "@/lib/pusher-client"
import { useSession } from "next-auth/react"
import "@/styles/creator/messages/MessagesLayout.scss"

type Conversation = Awaited<ReturnType<typeof getConversationsAction>>[0]
type Filter = "all" | "fans" | "subscribers"

export const MessagesLayout = () => {

    const { data: session } = useSession()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConvId, setActiveConvId] = useState<string | null>(null)
    const [filter, setFilter] = useState<Filter>("all")
    const [showRequests, setShowRequests] = useState(false)
    const [isPending, startTransition] = useTransition()

    const activeConv = conversations.find((c) => c.id === activeConvId) ?? null

    const fetchConversations = useCallback(() => {
        startTransition(async () => {
            const res = await getConversationsAction(filter)
            setConversations(res)
        })
    }, [filter])

    useEffect(() => { fetchConversations() }, [fetchConversations])

    // ── Listen for new messages on personal channel ───────────────────────────
    useEffect(() => {
        if (!session?.user?.id) return

        const pusher = getPusherClient()
        const channel = pusher.subscribe(`private-user-${session.user.id}`)

        channel.bind("new-conversation-message", (data: {
            conversationId: string
            message: any
        }) => {
            setConversations((prev) =>
                prev.map((conv) =>
                    conv.id === data.conversationId
                        ? {
                            ...conv,
                            lastMessageAt: data.message.createdAt,
                            lastMessageText: data.message.content ?? "",
                            unreadCount: conv.id === activeConvId
                                ? 0
                                : (conv.unreadCount ?? 0) + 1,
                        }
                        : conv
                ).sort((a, b) =>
                    new Date(b.lastMessageAt ?? 0).getTime() -
                    new Date(a.lastMessageAt ?? 0).getTime()
                )
            )
        })

        return () => {
            channel.unbind_all()
            pusher.unsubscribe(`private-user-${session.user.id}`)
        }
    }, [session?.user?.id, activeConvId])

    return (
        <div className="messages-layout">

            {/* ── Sidebar ── */}
            <div className="messages-sidebar">

                {/* Header */}
                <div className="messages-sidebar__header">
                    <div className="messages-sidebar__title">
                        <MessageCircle size={18} />
                        <h2>Messages</h2>
                    </div>

                    <button
                        className={`messages-requests-btn ${showRequests ? "messages-requests-btn--active" : ""}`}
                        onClick={() => setShowRequests((v) => !v)}
                    >
                        <Inbox size={15} />
                        Requests
                    </button>
                </div>

                {/* Filters */}
                <div className="messages-sidebar__filters">
                    {(["all", "subscribers", "fans"] as Filter[]).map((f) => (
                        <button
                            key={f}
                            className={`msg-filter-btn ${filter === f ? "msg-filter-btn--active" : ""}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === "all" && <MessageCircle size={13} />}
                            {f === "subscribers" && <Star size={13} />}
                            {f === "fans" && <Users size={13} />}
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Conversation list or requests */}
                {showRequests ? (
                    <MessageRequests
                        onAccepted={(convId: SetStateAction<string | null>) => {
                            setShowRequests(false)
                            fetchConversations()
                            setActiveConvId(convId)
                        }}
                    />
                ) : isPending ? (
                    <div className="messages-sidebar__loading">
                        <Loader2 size={20} className="spin" />
                    </div>
                ) : (
                    <ConversationList
                        conversations={conversations}
                        activeId={activeConvId}
                        onSelect={(id) => {
                            setActiveConvId(id)
                            // Clear unread badge optimistically
                            setConversations((prev) =>
                                prev.map((c) =>
                                    c.id === id ? { ...c, unreadCount: 0 } : c
                                )
                            )
                        }}
                    />
                )}
            </div>

            {/* ── Chat window ── */}
            <div className="messages-chat">
                {activeConv ? (
                    <ChatWindow
                        conversation={activeConv}
                        currentUserId={session?.user?.id ?? ""}
                        onMessageSent={fetchConversations}
                    />
                ) : (
                    <div className="messages-chat__empty">
                        <MessageCircle size={40} />
                        <h3>Select a conversation</h3>
                        <p>Choose a conversation from the sidebar to start messaging.</p>
                    </div>
                )}
            </div>

        </div>
    )
}