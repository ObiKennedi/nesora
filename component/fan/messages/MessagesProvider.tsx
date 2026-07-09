// components/fan/messages/MessagesProvider.tsx
"use client"

import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
} from "react"
import { getPusherClient }           from "@/lib/pusher-client"
import { getFanConversationsAction } from "@/actions/fan/messages"

// ── Types ─────────────────────────────────────────────────────────────────────

export type Conversation = {
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

/** Dock view. `closed` renders the collapsed pill. */
type DockView = "closed" | "list" | "thread"

type MessagesContextValue = {
    conversations: Conversation[]
    unreadCount:   number
    loading:       boolean
    refresh:       () => Promise<void>

    // Dock control
    dockView:      DockView
    activeConvId:  string | null
    openDock:      () => void
    closeDock:     () => void
    toggleDock:    () => void
    openConversation: (id: string) => void
    backToList:    () => void
}

const MessagesContext = createContext<MessagesContextValue | null>(null)

export function useMessages(): MessagesContextValue {
    const ctx = useContext(MessagesContext)
    if (!ctx) throw new Error("useMessages must be used inside <MessagesProvider>")
    return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export const MessagesProvider = ({
    currentUserId,
    children,
}: {
    currentUserId: string
    children: React.ReactNode
}) => {
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [loading,       setLoading]       = useState(true)
    const [dockView,      setDockView]      = useState<DockView>("closed")
    const [activeConvId,  setActiveConvId]  = useState<string | null>(null)

    // ── Fetch ─────────────────────────────────────────────────────────────────
    const refresh = useCallback(async () => {
        if (!currentUserId) return
        try {
            const data = await getFanConversationsAction()
            setConversations(data)
        } finally {
            setLoading(false)
        }
    }, [currentUserId])

    useEffect(() => { refresh() }, [refresh])

    // ── Real-time: bump on incoming messages ──────────────────────────────────
    //
    // The `user-${id}` channel is SHARED with call signalling (CallProvider).
    // Cleanup unbinds this handler only — unsubscribing would kill the channel
    // for every other consumer.
    useEffect(() => {
        if (!currentUserId) return

        const pusher  = getPusherClient()
        const name    = `user-${currentUserId}`
        const channel = pusher.subscribe(name)

        const onNewMessage = () => { refresh() }

        channel.bind("new-message", onNewMessage)

        return () => {
            channel.unbind("new-message", onNewMessage)
            // NOTE: intentionally NOT calling pusher.unsubscribe(name)
        }
    }, [currentUserId, refresh])

    // ── Derived ───────────────────────────────────────────────────────────────
    const unreadCount = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

    // ── Dock control ──────────────────────────────────────────────────────────
    const openDock  = useCallback(() => setDockView("list"), [])
    const closeDock = useCallback(() => {
        setDockView("closed")
        setActiveConvId(null)
    }, [])

    const toggleDock = useCallback(() => {
        setDockView((v) => (v === "closed" ? "list" : "closed"))
    }, [])

    const openConversation = useCallback((id: string) => {
        setActiveConvId(id)
        setDockView("thread")
    }, [])

    const backToList = useCallback(() => {
        setActiveConvId(null)
        setDockView("list")
    }, [])

    return (
        <MessagesContext.Provider
            value={{
                conversations,
                unreadCount,
                loading,
                refresh,
                dockView,
                activeConvId,
                openDock,
                closeDock,
                toggleDock,
                openConversation,
                backToList,
            }}
        >
            {children}
        </MessagesContext.Provider>
    )
}