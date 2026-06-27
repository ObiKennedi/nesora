"use client"

import { useState, useEffect }       from "react"
import Image                          from "next/image"
import { formatDistanceToNow }        from "date-fns"
import { Search, Mail, Loader2 }      from "lucide-react"
import { getFanConversationsAction }  from "@/actions/fan/messages"
import { getPusherClient }            from "@/lib/pusher-client"
import "@/styles/fan/messages/FanConversationList.scss"

// ── Types ─────────────────────────────────────────────────────────────────────

type Conversation = {
    id:              string
    lastMessageAt:   Date | null
    lastMessageText: string | null
    unreadCount:     number
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        user:        { image: string | null }
    }
    messages: {
        id:        string
        content:   string | null
        isRead:    boolean
        senderId:  string
        createdAt: Date
    }[]
}

type Props = {
    conversations:  Conversation[]
    activeId:       string | null
    onSelect:       (id: string) => void
    currentUserId:  string
}

// ── Component ─────────────────────────────────────────────────────────────────

export const FanConversationList = ({
    conversations: initial,
    activeId,
    onSelect,
    currentUserId,
}: Props) => {
    const [conversations, setConversations] = useState<Conversation[]>(initial)
    const [search, setSearch]               = useState("")
    const [loading, setLoading]             = useState(false)

    // Keep in sync with parent
    useEffect(() => { setConversations(initial) }, [initial])

    // ── Pusher: live updates on the user's personal channel ───────────────────
    useEffect(() => {
        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`private-user-${currentUserId}`)

        channel.bind(
            "new-conversation-message",
            (data: { conversationId: string; message: { content: string | null; createdAt: Date; sender: { firstName: string | null } } }) => {
                setConversations((prev) => {
                    const idx = prev.findIndex((c) => c.id === data.conversationId)
                    if (idx === -1) {
                        // New conversation — refetch
                        refreshConversations()
                        return prev
                    }
                    const updated = [...prev]
                    updated[idx] = {
                        ...updated[idx],
                        lastMessageAt:   data.message.createdAt,
                        lastMessageText: data.message.content?.slice(0, 100) ?? "",
                        unreadCount:     data.conversationId === activeId
                            ? updated[idx].unreadCount
                            : updated[idx].unreadCount + 1,
                    }
                    // Re-sort: newest first
                    updated.sort((a, b) =>
                        new Date(b.lastMessageAt ?? 0).getTime() -
                        new Date(a.lastMessageAt ?? 0).getTime()
                    )
                    return updated
                })
            }
        )

        channel.bind("message-request-accepted", () => {
            refreshConversations()
        })

        return () => {
            channel.unbind_all()
            pusher.unsubscribe(`private-user-${currentUserId}`)
        }
    }, [currentUserId, activeId])

    const refreshConversations = async () => {
        setLoading(true)
        try {
            const data = await getFanConversationsAction()
            setConversations(data)
        } finally {
            setLoading(false)
        }
    }

    // ── Filter ────────────────────────────────────────────────────────────────
    const filtered = conversations.filter((conv) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
            conv.creator.displayName.toLowerCase().includes(q) ||
            conv.creator.handle?.toLowerCase().includes(q)
        )
    })

    // ── Empty state ───────────────────────────────────────────────────────────
    if (conversations.length === 0 && !loading) {
        return (
            <div className="fan-conv-list__empty">
                <Mail size={32} />
                <p>No conversations yet</p>
                <span>Send a message request to start chatting with a creator</span>
            </div>
        )
    }

    return (
        <div className="fan-conv-list">
            {/* Search */}
            <div className="fan-conv-list__search">
                <Search size={16} />
                <input
                    type="text"
                    placeholder="Search conversations..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* List */}
            <div className="fan-conv-list__items">
                {loading && (
                    <div className="fan-conv-list__loading">
                        <Loader2 size={18} className="spin" />
                    </div>
                )}

                {filtered.map((conv) => {
                    const hasUnread = conv.unreadCount > 0

                    return (
                        <button
                            key={conv.id}
                            className={`fan-conv-item ${activeId === conv.id ? "fan-conv-item--active" : ""} ${hasUnread ? "fan-conv-item--unread" : ""}`}
                            onClick={() => onSelect(conv.id)}
                        >
                            {/* Avatar */}
                            <div className="fan-conv-item__avatar">
                                {conv.creator.user.image ? (
                                    <Image
                                        src={conv.creator.user.image}
                                        alt={conv.creator.displayName}
                                        width={44}
                                        height={44}
                                    />
                                ) : (
                                    <span>
                                        {conv.creator.displayName.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>

                            {/* Info */}
                            <div className="fan-conv-item__info">
                                <div className="fan-conv-item__top">
                                    <span className="fan-conv-item__name">
                                        {conv.creator.displayName}
                                    </span>
                                    {conv.lastMessageAt && (
                                        <span className="fan-conv-item__time">
                                            {formatDistanceToNow(
                                                new Date(conv.lastMessageAt),
                                                { addSuffix: false }
                                            )}
                                        </span>
                                    )}
                                </div>
                                <div className="fan-conv-item__bottom">
                                    <span className="fan-conv-item__preview">
                                        {conv.lastMessageText ?? "No messages yet"}
                                    </span>
                                    {hasUnread && (
                                        <span className="fan-conv-item__badge">
                                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    )
                })}

                {filtered.length === 0 && search.trim() && (
                    <div className="fan-conv-list__no-results">
                        <p>No conversations match "{search}"</p>
                    </div>
                )}
            </div>
        </div>
    )
}
