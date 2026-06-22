// components/creator/messages/ConversationList.tsx
"use client"

import Image           from "next/image"
import { formatDistanceToNow } from "date-fns"
import { Star }        from "lucide-react"
import "@/styles/creator/messages/ConversationList.scss"

type Conversation = {
    id:              string
    lastMessageAt:   Date | null
    lastMessageText: string | null
    unreadCount:     number
    subscriber: {
        id:        string
        username:  string | null
        firstName: string | null
        lastName:  string | null
        image:     string | null
        subscriptions: { id: string }[]
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
    conversations: Conversation[]
    activeId:      string | null
    onSelect:      (id: string) => void
}

export const ConversationList = ({
    conversations,
    activeId,
    onSelect,
}: Props) => {

    if (conversations.length === 0) {
        return (
            <div className="conv-list__empty">
                <p>No conversations yet</p>
                <span>Messages from fans will appear here</span>
            </div>
        )
    }

    return (
        <div className="conv-list">
            {conversations.map((conv) => {
                const name = [conv.subscriber.firstName, conv.subscriber.lastName]
                    .filter(Boolean).join(" ") || "Anonymous"
                const handle      = conv.subscriber.username ? `@${conv.subscriber.username}` : null
                const isSubscriber = conv.subscriber.subscriptions.length > 0
                const lastMsg     = conv.messages[0]
                const hasUnread   = (conv.unreadCount ?? 0) > 0

                return (
                    <button
                        key={conv.id}
                        className={`conv-item ${activeId === conv.id ? "conv-item--active" : ""} ${hasUnread ? "conv-item--unread" : ""}`}
                        onClick={() => onSelect(conv.id)}
                    >
                        {/* Avatar */}
                        <div className="conv-item__avatar">
                            {conv.subscriber.image ? (
                                <Image
                                    src={conv.subscriber.image}
                                    alt={name}
                                    width={40}
                                    height={40}
                                />
                            ) : (
                                <span>{name.charAt(0).toUpperCase()}</span>
                            )}
                            {isSubscriber && (
                                <span className="conv-item__sub-dot" title="Subscriber">
                                    <Star size={8} />
                                </span>
                            )}
                        </div>

                        {/* Info */}
                        <div className="conv-item__info">
                            <div className="conv-item__top">
                                <span className="conv-item__name">{name}</span>
                                {conv.lastMessageAt && (
                                    <span className="conv-item__time">
                                        {formatDistanceToNow(
                                            new Date(conv.lastMessageAt),
                                            { addSuffix: false }
                                        )}
                                    </span>
                                )}
                            </div>
                            <div className="conv-item__bottom">
                                <span className="conv-item__preview">
                                    {conv.lastMessageText ?? "No messages yet"}
                                </span>
                                {hasUnread && (
                                    <span className="conv-item__badge">
                                        {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}