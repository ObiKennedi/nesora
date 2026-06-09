// components/creator/layout/NotificationsBell.tsx
"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Bell, X, Check, CheckCheck } from "lucide-react"
import { getNotifications, markAllRead, markOneRead } from "@/actions/creator/notifications"

type Notification = {
    id: string
    type: string
    title: string
    body: string
    read: boolean
    href: string | null
    createdAt: Date
}

const typeColors: Record<string, string> = {
    NEW_FOLLOWER: "primary",
    NEW_SUBSCRIBER: "green",
    NEW_MESSAGE: "blue",
    GIFT_RECEIVED: "amber",
    TIP_RECEIVED: "amber",
    LIVE_STARTING: "red",
    SUBSCRIPTION_EXPIRING: "purple",
    PAYOUT_PROCESSED: "green",
    VERIFICATION_UPDATE: "blue",
    SYSTEM: "primary",
}

export const NotificationsBell = () => {
    const [open, setOpen] = useState(false)
    const [items, setItems] = useState<Notification[]>([])
    const [isPending, startTransition] = useTransition()
    const panelRef = useRef<HTMLDivElement>(null)

    const unread = items.filter((n) => !n.read).length

    // Fetch on mount + every 60s
    useEffect(() => {
        const load = () => {
            startTransition(async () => {
                const data = await getNotifications()
                setItems(data)
            })
        }
        load()
        const interval = setInterval(load, 60_000)
        return () => clearInterval(interval)
    }, [])

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const handleMarkAll = () => {
        startTransition(async () => {
            await markAllRead()
            setItems((prev) => prev.map((n) => ({ ...n, read: true })))
        })
    }

    const handleMarkOne = (id: string) => {
        startTransition(async () => {
            await markOneRead(id)
            setItems((prev) =>
                prev.map((n) => n.id === id ? { ...n, read: true } : n)
            )
        })
    }

    const formatTime = (date: Date) => {
        const diff = Date.now() - new Date(date).getTime()
        const mins = Math.floor(diff / 60_000)
        const hours = Math.floor(diff / 3_600_000)
        const days = Math.floor(diff / 86_400_000)
        if (mins < 1) return "just now"
        if (mins < 60) return `${mins}m ago`
        if (hours < 24) return `${hours}h ago`
        return `${days}d ago`
    }

    return (
        <div className="notif-bell" ref={panelRef}>
            <button
                className="creator-header__icon-btn"
                aria-label="Notifications"
                onClick={() => setOpen((v) => !v)}
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span className="creator-header__badge">
                        {unread > 9 ? "9+" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="notif-panel">
                    {/* Header */}
                    <div className="notif-panel__head">
                        <span>Notifications</span>
                        <div className="notif-panel__head-actions">
                            {unread > 0 && (
                                <button
                                    className="notif-panel__mark-all"
                                    onClick={handleMarkAll}
                                    disabled={isPending}
                                >
                                    <CheckCheck size={14} />
                                    Mark all read
                                </button>
                            )}
                            <button
                                className="notif-panel__close"
                                onClick={() => setOpen(false)}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="notif-panel__list">
                        {items.length === 0 ? (
                            <div className="notif-panel__empty">
                                <Bell size={24} />
                                <p>No notifications yet</p>
                            </div>
                        ) : (
                            items.map((n) => (
                                <div
                                    key={n.id}
                                    className={`notif-item ${!n.read ? "notif-item--unread" : ""}`}
                                    onClick={() => !n.read && handleMarkOne(n.id)}
                                >
                                    <div className={`notif-item__dot notif-item__dot--${typeColors[n.type] ?? "primary"}`} />
                                    <div className="notif-item__body">
                                        <p className="notif-item__title">{n.title}</p>
                                        <p className="notif-item__text">{n.body}</p>
                                        <span className="notif-item__time">
                                            {formatTime(n.createdAt)}
                                        </span>
                                    </div>
                                    {!n.read && (
                                        <button
                                            className="notif-item__check"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleMarkOne(n.id)
                                            }}
                                            aria-label="Mark as read"
                                        >
                                            <Check size={12} />
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}