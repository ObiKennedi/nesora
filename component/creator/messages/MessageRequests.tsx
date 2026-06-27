// components/creator/messages/MessageRequests.tsx
"use client"

import { useState, useEffect, useTransition } from "react"
import Image                                   from "next/image"
import { CheckCircle, X, Loader2 }             from "lucide-react"
import {
    getMessageRequestsAction,
    acceptMessageRequestAction,
    declineMessageRequestAction,
} from "@/actions/creator/messages"
import { formatDistanceToNow } from "date-fns"
import "@/styles/creator/messages/MessageRequests.scss"

type RequestsResult = Awaited<ReturnType<typeof getMessageRequestsAction>>
type Request = Exclude<RequestsResult, { error: string }>[0]

type Props = {
    onAccepted: (conversationId: string) => void
}

export const MessageRequests = ({ onAccepted }: Props) => {

    const [requests,  setRequests]  = useState<Request[]>([])
    const [isPending, startTransition] = useTransition()
    const [acting,    setActing]    = useState<string | null>(null)

    useEffect(() => {
        startTransition(async () => {
            const res = await getMessageRequestsAction()
            if ("error" in res) return
            setRequests(res)
        })
    }, [])

    const handleAccept = (requestId: string) => {
        setActing(requestId)
        startTransition(async () => {
            const res = await acceptMessageRequestAction(requestId)
            if (res?.success && res.conversationId) {
                setRequests((prev) => prev.filter((r) => r.id !== requestId))
                onAccepted(res.conversationId)
            }
            setActing(null)
        })
    }

    const handleDecline = (requestId: string) => {
        setActing(requestId)
        startTransition(async () => {
            await declineMessageRequestAction(requestId)
            setRequests((prev) => prev.filter((r) => r.id !== requestId))
            setActing(null)
        })
    }

    if (isPending && requests.length === 0) {
        return (
            <div className="msg-requests__loading">
                <Loader2 size={20} className="spin" />
            </div>
        )
    }

    if (requests.length === 0) {
        return (
            <div className="msg-requests__empty">
                <p>No pending requests</p>
                <span>New message requests will appear here</span>
            </div>
        )
    }

    return (
        <div className="msg-requests">
            {requests.map((req) => {
                const name   = [req.fromUser.firstName, req.fromUser.lastName]
                    .filter(Boolean).join(" ") || "Anonymous"
                const handle = req.fromUser.username
                    ? `@${req.fromUser.username}`
                    : null
                const isActing = acting === req.id

                return (
                    <div key={req.id} className="msg-request-item">
                        <div className="msg-request-item__avatar">
                            {req.fromUser.image ? (
                                <Image
                                    src={req.fromUser.image}
                                    alt={name}
                                    width={40}
                                    height={40}
                                />
                            ) : (
                                <span>{name.charAt(0).toUpperCase()}</span>
                            )}
                        </div>

                        <div className="msg-request-item__body">
                            <div className="msg-request-item__top">
                                <p className="msg-request-item__name">{name}</p>
                                <span className="msg-request-item__time">
                                    {formatDistanceToNow(
                                        new Date(req.createdAt),
                                        { addSuffix: true }
                                    )}
                                </span>
                            </div>
                            {handle && (
                                <p className="msg-request-item__handle">{handle}</p>
                            )}
                            <p className="msg-request-item__preview">
                                {req.message}
                            </p>
                        </div>

                        <div className="msg-request-item__actions">
                            <button
                                className="msg-req-btn msg-req-btn--accept"
                                onClick={() => handleAccept(req.id)}
                                disabled={isActing}
                                title="Accept"
                            >
                                {isActing
                                    ? <Loader2     size={14} className="spin" />
                                    : <CheckCircle size={14} />
                                }
                            </button>
                            <button
                                className="msg-req-btn msg-req-btn--decline"
                                onClick={() => handleDecline(req.id)}
                                disabled={isActing}
                                title="Decline"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}