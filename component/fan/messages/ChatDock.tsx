// components/fan/messages/ChatDock.tsx
"use client"

import Link                    from "next/link"
import { usePathname }         from "next/navigation"
import {
    MessageCircle, ChevronDown, X,
    Loader2, Maximize2,
} from "lucide-react"
import { useMessages }         from "./MessagesProvider"
import { FanConversationList } from "./FanConversationList"
import { FanChatWindow }       from "./FanChatWindow"
import "@/styles/fan/ChatDock.scss"

type Props = {
    currentUserId: string
}

export const ChatDock = ({ currentUserId }: Props) => {
    const pathname = usePathname()
    const {
        conversations,
        unreadCount,
        loading,
        refresh,
        dockView,
        activeConvId,
        toggleDock,
        closeDock,
        openConversation,
        backToList,
    } = useMessages()

    // The full messages page already IS the messages surface — don't dock on top
    // of it. (CSS hides the dock below 1024px.)
    if (pathname.startsWith("/fan/messages")) return null

    const activeConv = conversations.find((c) => c.id === activeConvId) ?? null

    // ── Collapsed pill ────────────────────────────────────────────────────────
    if (dockView === "closed") {
        return (
            <button
                type="button"
                className="chat-dock__pill"
                onClick={toggleDock}
                aria-label={`Open messages${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            >
                <MessageCircle size={20} />
                <span className="chat-dock__pill-label">Messages</span>
                {unreadCount > 0 && (
                    <span className="chat-dock__pill-badge">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>
        )
    }

    // ── Expanded dock ─────────────────────────────────────────────────────────
    return (
        <section
            className="chat-dock"
            aria-label="Messages"
        >
            {/* Header */}
            <header className="chat-dock__header">
                {dockView === "thread" && activeConv ? (
                    <button
                        type="button"
                        className="chat-dock__back"
                        onClick={backToList}
                        aria-label="Back to conversations"
                    >
                        ←
                    </button>
                ) : (
                    <MessageCircle size={17} className="chat-dock__header-icon" />
                )}

                <span className="chat-dock__title">
                    {dockView === "thread" && activeConv
                        ? activeConv.creator.displayName
                        : "Messages"}
                    {dockView === "list" && unreadCount > 0 && (
                        <span className="chat-dock__title-count">{unreadCount}</span>
                    )}
                </span>

                <div className="chat-dock__header-actions">
                    <Link
                        href="/fan/messages"
                        className="chat-dock__icon-btn"
                        aria-label="Open full messages"
                        onClick={closeDock}
                    >
                        <Maximize2 size={15} />
                    </Link>

                    <button
                        type="button"
                        className="chat-dock__icon-btn"
                        onClick={toggleDock}
                        aria-label="Minimise"
                    >
                        <ChevronDown size={17} />
                    </button>

                    <button
                        type="button"
                        className="chat-dock__icon-btn"
                        onClick={closeDock}
                        aria-label="Close messages"
                    >
                        <X size={16} />
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="chat-dock__body">
                {loading ? (
                    <div className="chat-dock__loading">
                        <Loader2 size={20} className="spin" />
                    </div>
                ) : dockView === "thread" && activeConv ? (
                    <FanChatWindow
                        conversation={activeConv}
                        currentUserId={currentUserId}
                        onMessageSent={refresh}
                        onBack={backToList}
                    />
                ) : conversations.length === 0 ? (
                    <div className="chat-dock__empty">
                        <MessageCircle size={28} />
                        <p>No conversations yet</p>
                        <Link href="/fan/messages" className="chat-dock__empty-link">
                            Message a creator
                        </Link>
                    </div>
                ) : (
                    <FanConversationList
                        conversations={conversations}
                        activeId={activeConvId}
                        onSelect={openConversation}
                        currentUserId={currentUserId}
                    />
                )}
            </div>
        </section>
    )
}