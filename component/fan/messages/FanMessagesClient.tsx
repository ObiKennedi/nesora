"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageSquarePlus, Loader2 }        from "lucide-react"
import { getFanConversationsAction }         from "@/actions/fan/messages"
import { FanConversationList }               from "./FanConversationList"
import { FanChatWindow }                     from "./FanChatWindow"
import { FanMessageRequest }                 from "./FanMessageRequest"
import "@/styles/fan/messages/FanMessagesClient.scss"

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
    currentUserId: string
}

type View = "list" | "chat" | "request"

// ── Component ─────────────────────────────────────────────────────────────────

export const FanMessagesClient = ({ currentUserId }: Props) => {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConvId,  setActiveConvId]  = useState<string | null>(null)
    const [loading,       setLoading]       = useState(true)
    const [mobileView,    setMobileView]    = useState<View>("list")

    // ── Fetch conversations ───────────────────────────────────────────────────
    const fetchConversations = useCallback(async () => {
        try {
            const data = await getFanConversationsAction()
            setConversations(data)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchConversations() }, [fetchConversations])

    // ── Select conversation ───────────────────────────────────────────────────
    const handleSelect = (id: string) => {
        setActiveConvId(id)
        setMobileView("chat")
    }

    // ── Back to list (mobile) ─────────────────────────────────────────────────
    const handleBack = () => {
        setActiveConvId(null)
        setMobileView("list")
    }

    // ── Open message request form ─────────────────────────────────────────────
    const handleOpenRequest = () => {
        setMobileView("request")
    }

    const handleBackFromRequest = () => {
        setMobileView("list")
    }

    // ── After sending a message or request ────────────────────────────────────
    const handleMessageSent = () => {
        fetchConversations()
    }

    const handleRequestSent = () => {
        fetchConversations()
    }

    // ── Open conversation from request panel (subscriber direct message) ──────
    const handleOpenConversation = (conversationId: string) => {
        fetchConversations()
        setActiveConvId(conversationId)
        setMobileView("chat")
    }

    // ── Active conversation object ────────────────────────────────────────────
    const activeConv = conversations.find((c) => c.id === activeConvId) ?? null

    if (loading) {
        return (
            <div className="fan-messages__loading">
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    return (
        <div className="fan-messages">

            {/* ── Sidebar: conversation list ── */}
            <div className={`fan-messages__sidebar ${mobileView !== "list" ? "fan-messages__sidebar--hidden-mobile" : ""}`}>
                <div className="fan-messages__sidebar-header">
                    <h2>Messages</h2>
                    <button
                        className="fan-messages__new-btn"
                        onClick={handleOpenRequest}
                        title="New message request"
                    >
                        <MessageSquarePlus size={18} />
                    </button>
                </div>

                <FanConversationList
                    conversations={conversations}
                    activeId={activeConvId}
                    onSelect={handleSelect}
                    currentUserId={currentUserId}
                />
            </div>

            {/* ── Main panel ── */}
            <div className={`fan-messages__main ${mobileView === "list" ? "fan-messages__main--hidden-mobile" : ""}`}>
                {mobileView === "request" ? (
                    <div className="fan-messages__request-panel">
                        <button
                            className="fan-messages__back-link"
                            onClick={handleBackFromRequest}
                        >
                            &larr; Back to messages
                        </button>
                        <FanMessageRequest
                            onOpenConversation={handleOpenConversation}
                            onRequestSent={handleRequestSent}
                        />
                    </div>
                ) : activeConv ? (
                    <FanChatWindow
                        conversation={activeConv}
                        currentUserId={currentUserId}
                        onMessageSent={handleMessageSent}
                        onBack={handleBack}
                    />
                ) : (
                    <div className="fan-messages__empty-state">
                        <MessageSquarePlus size={40} />
                        <h3>Your messages</h3>
                        <p>Select a conversation or send a new message request to a creator</p>
                        <button
                            className="fan-messages__start-btn"
                            onClick={handleOpenRequest}
                        >
                            <MessageSquarePlus size={16} />
                            New Message Request
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
