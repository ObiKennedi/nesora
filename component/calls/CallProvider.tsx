"use client"

import {
    createContext, useContext, useState, useRef,
    useEffect, useCallback, type ReactNode,
} from "react"
import Daily, {
    type DailyCall,
    type DailyEventObjectParticipant,
} from "@daily-co/daily-js"
import type { Channel }         from "pusher-js"
import { getPusherClient }      from "@/lib/pusher-client"
import { initiateCallAction }   from "@/actions/calls/initiate-call"
import { respondToCallAction }  from "@/actions/calls/respond-to-call"
import { endCallAction }        from "@/actions/calls/end-call"
import { IncomingCallModal }    from "./IncomingCallModal"
import { CallRoom }             from "./CallRoom"

export type CallKind  = "VOICE" | "VIDEO"
export type CallPhase = "idle" | "outgoing-ringing" | "connecting" | "in-call"

export type Counterpart = {
    name:  string
    image: string | null
}

export type ActiveCall = {
    callId:         string
    conversationId: string
    type:           CallKind
    isFreeCall:     boolean
    ratePerHour:    number
    counterpart:    Counterpart
}

export type IncomingCall = {
    callId:         string
    conversationId: string
    type:           CallKind
    isFreeCall:     boolean
    ratePerHour:    number
    fan:            { id: string; name: string; image: string | null }
}

export type EndSummary = {
    status:          "ENDED" | "MISSED" | "DECLINED" | "FAILED"
    durationMinutes: number
    billedAmount:    number
    reason?:         string // "insufficient-balance" | "abandoned"
    counterpart:     Counterpart
    type:            CallKind
}

export type RemoteMedia = {
    name:       string
    videoTrack: MediaStreamTrack | null
    audioTrack: MediaStreamTrack | null
}

export type StartCallArgs = {
    conversationId: string
    type:           CallKind
    counterpart:    Counterpart
}

export type StartCallFailure = {
    error:     string
    code?:     string
    required?: number
    balance?:  number
}

type CallContextValue = {
    phase:           CallPhase
    activeCall:      ActiveCall | null
    incoming:        IncomingCall | null
    endSummary:      EndSummary | null
    elapsedSeconds:  number
    lowBalance:      boolean
    isMuted:         boolean
    isCameraOff:     boolean
    localVideoTrack: MediaStreamTrack | null
    remote:          RemoteMedia | null

    startCall:       (args: StartCallArgs) => Promise<StartCallFailure | null>
    acceptIncoming:  () => Promise<void>
    declineIncoming: () => Promise<void>
    hangUp:          () => Promise<void>
    toggleMute:      () => void
    toggleCamera:    () => void
    dismissSummary:  () => void
}

const CallContext = createContext<CallContextValue | null>(null)

export const useCall = () => {
    const ctx = useContext(CallContext)
    if (!ctx) throw new Error("useCall must be used inside <CallProvider>")
    return ctx
}

const RING_TIMEOUT_MS = 45_000

// ── Provider ──────────────────────────────────────────────────────────────────

type Props = {
    role:          "fan" | "creator"
    currentUserId: string
    children:      ReactNode
}

export const CallProvider = ({ role, currentUserId, children }: Props) => {

    const [phase,           setPhase]           = useState<CallPhase>("idle")
    const [activeCall,      setActiveCall]      = useState<ActiveCall | null>(null)
    const [incoming,        setIncoming]        = useState<IncomingCall | null>(null)
    const [endSummary,      setEndSummary]      = useState<EndSummary | null>(null)
    const [elapsedSeconds,  setElapsedSeconds]  = useState(0)
    const [lowBalance,      setLowBalance]      = useState(false)
    const [isMuted,         setIsMuted]         = useState(false)
    const [isCameraOff,     setIsCameraOff]     = useState(false)
    const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null)
    const [remote,          setRemote]          = useState<RemoteMedia | null>(null)

    // Refs mirror state so Pusher/Daily handlers never see stale closures
    const activeCallRef = useRef<ActiveCall | null>(null)
    const incomingRef   = useRef<IncomingCall | null>(null)
    const phaseRef      = useRef<CallPhase>("idle")
    useEffect(() => { activeCallRef.current = activeCall }, [activeCall])
    useEffect(() => { incomingRef.current   = incoming   }, [incoming])
    useEffect(() => { phaseRef.current      = phase      }, [phase])

    const callObjectRef   = useRef<DailyCall | null>(null)
    const roomRef         = useRef<{ url: string; token: string } | null>(null)
    const ringTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)
    const tickRef         = useRef<ReturnType<typeof setInterval> | null>(null)
    const ringtoneRef     = useRef<HTMLAudioElement | null>(null)
    const convChannelRef  = useRef<Channel | null>(null)
    const convHandlersRef = useRef<Record<string, (data: never) => void> | null>(null)

    // Per-call conversation channel: unbind our handlers only — the chat
    // windows subscribe to the same channel, and pusher-js unsubscribe()
    // would kill it for them too.
    function unbindConversationChannel() {
        const channel  = convChannelRef.current
        const handlers = convHandlersRef.current
        if (channel && handlers) {
            for (const [event, handler] of Object.entries(handlers)) {
                channel.unbind(event, handler)
            }
        }
        convChannelRef.current  = null
        convHandlersRef.current = null
    }

    // ── Ringtone helpers (creator side) ────────────────────────────────────
    const startRingtone = useCallback(() => {
        // Optional asset: drop any short loopable mp3 at public/sounds/ringtone.mp3.
        // Missing file or autoplay policy just fails silently.
        try {
            if (!ringtoneRef.current) {
                ringtoneRef.current = new Audio("/sounds/ringtone.mp3")
                ringtoneRef.current.loop = true
            }
            void ringtoneRef.current.play().catch(() => {})
        } catch { /* no ringtone — modal alone is fine */ }
    }, [])

    const stopRingtone = useCallback(() => {
        ringtoneRef.current?.pause()
        if (ringtoneRef.current) ringtoneRef.current.currentTime = 0
    }, [])

    // ── Teardown ───────────────────────────────────────────────────────────
    const teardownDaily = useCallback(async () => {
        unbindConversationChannel()
        const co = callObjectRef.current
        callObjectRef.current = null
        if (co) {
            try { await co.leave() } catch { /* already left */ }
            try { co.destroy()     } catch { /* already destroyed */ }
        }
        if (tickRef.current)      { clearInterval(tickRef.current);   tickRef.current = null }
        if (ringTimerRef.current) { clearTimeout(ringTimerRef.current); ringTimerRef.current = null }
        setElapsedSeconds(0)
        setLowBalance(false)
        setIsMuted(false)
        setIsCameraOff(false)
        setLocalVideoTrack(null)
        setRemote(null)
        roomRef.current = null
    }, [])

    const finishCall = useCallback(async (summary: EndSummary | null) => {
        await teardownDaily()
        setActiveCall(null)
        setPhase("idle")
        if (summary) setEndSummary(summary)
    }, [teardownDaily])

    // ── Daily participant sync ─────────────────────────────────────────────
    const syncParticipant = useCallback((ev: DailyEventObjectParticipant) => {
        const p = ev.participant
        if (p.local) {
            setLocalVideoTrack(
                p.tracks.video.state === "playable"
                    ? p.tracks.video.persistentTrack ?? null
                    : null,
            )
            return
        }
        setRemote({
            name:       p.user_name || "Participant",
            videoTrack: p.tracks.video.state === "playable"
                ? p.tracks.video.persistentTrack ?? null : null,
            audioTrack: p.tracks.audio.state === "playable"
                ? p.tracks.audio.persistentTrack ?? null : null,
        })
    }, [])

    // ── Join the Daily room ────────────────────────────────────────────────
    const joinRoom = useCallback(async (type: CallKind) => {
        const room = roomRef.current
        if (!room) return

        setPhase("connecting")

        const co = Daily.createCallObject()
        callObjectRef.current = co

        co.on("participant-joined",  syncParticipant)
        co.on("participant-updated", syncParticipant)
        co.on("participant-left",    () => setRemote(null))

        co.on("joined-meeting", () => {
            setPhase("in-call")
            setElapsedSeconds(0)
            if (tickRef.current) clearInterval(tickRef.current)
            tickRef.current = setInterval(
                () => setElapsedSeconds((s) => s + 1),
                1_000,
            )
        })

        co.on("error", (e) => {
            console.error("[calls] Daily error:", e)
            const call = activeCallRef.current
            void finishCall(call ? {
                status: "FAILED", durationMinutes: 0, billedAmount: 0,
                counterpart: call.counterpart, type: call.type,
            } : null)
            if (call) void endCallAction(call.callId).catch(() => {})
        })

        try {
            await co.join({
                url:           room.url,
                token:         room.token,
                startVideoOff: type === "VOICE",
                startAudioOff: false,
            })
        } catch (err) {
            console.error("[calls] join failed:", err)
            const call = activeCallRef.current
            await finishCall(call ? {
                status: "FAILED", durationMinutes: 0, billedAmount: 0,
                counterpart: call.counterpart, type: call.type,
            } : null)
            if (call) void endCallAction(call.callId).catch(() => {})
        }
    }, [syncParticipant, finishCall])

    // ── Per-call conversation channel binding ──────────────────────────────
    // Bound at call start (fan) / accept (creator); unbound in teardownDaily.
    const bindConversationChannel = useCallback((conversationId: string) => {
        unbindConversationChannel()

        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`private-conversation-${conversationId}`)

        const onAccepted = (data: { callId: string }) => {
            const call = activeCallRef.current
            if (!call || call.callId !== data.callId) return
            if (phaseRef.current !== "outgoing-ringing") return
            if (ringTimerRef.current) clearTimeout(ringTimerRef.current)
            void joinRoom(call.type)
        }

        const onNotAnswered = (status: "DECLINED" | "MISSED") =>
            (data: { callId: string }) => {
                const call = activeCallRef.current
                if (!call || call.callId !== data.callId) return
                if (phaseRef.current !== "outgoing-ringing") return
                void finishCall({
                    status, durationMinutes: 0, billedAmount: 0,
                    counterpart: call.counterpart, type: call.type,
                })
            }
        const onDeclined = onNotAnswered("DECLINED")
        const onMissed   = onNotAnswered("MISSED")

        const onFailed = (data: { callId: string }) => {
            const call = activeCallRef.current
            if (!call || call.callId !== data.callId) return
            void finishCall({
                status: "FAILED", durationMinutes: 0, billedAmount: 0,
                counterpart: call.counterpart, type: call.type,
            })
        }

        const onEnded = (data: {
            callId: string; durationMinutes: number
            billedAmount: number; reason?: string
        }) => {
            const call = activeCallRef.current
            if (!call || call.callId !== data.callId) return
            void finishCall({
                status:          "ENDED",
                durationMinutes: data.durationMinutes,
                billedAmount:    data.billedAmount,
                reason:          data.reason,
                counterpart:     call.counterpart,
                type:            call.type,
            })
        }

        const onLowBalance = (data: { callId: string }) => {
            if (activeCallRef.current?.callId === data.callId) setLowBalance(true)
        }

        const handlers = {
            "call-accepted":           onAccepted,
            "call-declined":           onDeclined,
            "call-missed":             onMissed,
            "call-failed":             onFailed,
            "call-ended":              onEnded,
            "call-ending-low-balance": onLowBalance,
        }
        for (const [event, handler] of Object.entries(handlers)) {
            channel.bind(event, handler)
        }
        convChannelRef.current  = channel
        convHandlersRef.current = handlers as Record<string, (data: never) => void>
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [joinRoom, finishCall])

    // ── Public: fan starts a call ──────────────────────────────────────────
    const startCall = useCallback(async (
        args: StartCallArgs,
    ): Promise<StartCallFailure | null> => {
        if (phaseRef.current !== "idle") {
            return { error: "You're already in a call." }
        }
        setEndSummary(null)

        const res = await initiateCallAction({
            conversationId: args.conversationId,
            type:           args.type,
        })
        if ("error" in res) return res

        roomRef.current = res.room
        const call: ActiveCall = {
            callId:         res.call.id,
            conversationId: args.conversationId,
            type:           res.call.type,
            isFreeCall:     res.call.isFreeCall,
            ratePerHour:    res.call.ratePerHour,
            counterpart:    args.counterpart,
        }
        setActiveCall(call)
        bindConversationChannel(args.conversationId)
        setPhase("outgoing-ringing")

        // Client-side ring timeout (server sweeper is the 60s backstop)
        ringTimerRef.current = setTimeout(() => {
            const current = activeCallRef.current
            if (!current || phaseRef.current !== "outgoing-ringing") return
            void endCallAction(current.callId).catch(() => {}) // ⇒ MISSED
            void finishCall({
                status: "MISSED", durationMinutes: 0, billedAmount: 0,
                counterpart: current.counterpart, type: current.type,
            })
        }, RING_TIMEOUT_MS)

        return null
    }, [finishCall, bindConversationChannel])

    // ── Public: fan cancels ring / either party hangs up ───────────────────
    const hangUp = useCallback(async () => {
        const call = activeCallRef.current
        if (!call) return

        const wasRinging = phaseRef.current === "outgoing-ringing"
        await teardownDaily()
        setActiveCall(null)
        setPhase("idle")

        const res = await endCallAction(call.callId).catch(() => null)

        if (wasRinging) return // cancelled ring — no summary needed
        setEndSummary({
            status:          "ENDED",
            durationMinutes: res && "success" in res ? res.summary.durationMinutes : 0,
            billedAmount:    res && "success" in res ? res.summary.billedAmount    : 0,
            counterpart:     call.counterpart,
            type:            call.type,
        })
    }, [teardownDaily])

    // ── Public: creator accepts / declines ─────────────────────────────────
    const acceptIncoming = useCallback(async () => {
        const inc = incomingRef.current
        if (!inc) return
        stopRingtone()

        const res = await respondToCallAction(inc.callId, true)
        if ("error" in res || !res.accepted) {
            setIncoming(null) // rang out or was cancelled under us
            return
        }

        roomRef.current = res.room
        setActiveCall({
            callId:         inc.callId,
            conversationId: inc.conversationId,
            type:           inc.type,
            isFreeCall:     inc.isFreeCall,
            ratePerHour:    inc.ratePerHour,
            counterpart:    { name: inc.fan.name, image: inc.fan.image },
        })
        setIncoming(null)
        bindConversationChannel(inc.conversationId)
        await joinRoom(inc.type)
    }, [joinRoom, stopRingtone, bindConversationChannel])

    const declineIncoming = useCallback(async () => {
        const inc = incomingRef.current
        if (!inc) return
        stopRingtone()
        setIncoming(null)
        await respondToCallAction(inc.callId, false).catch(() => {})
    }, [stopRingtone])

    // ── Public: media controls ─────────────────────────────────────────────
    const toggleMute = useCallback(() => {
        const co = callObjectRef.current
        if (!co) return
        setIsMuted((m) => { co.setLocalAudio(m); return !m })
    }, [])

    const toggleCamera = useCallback(() => {
        const co = callObjectRef.current
        if (!co) return
        setIsCameraOff((off) => { co.setLocalVideo(off); return !off })
    }, [])

    const dismissSummary = useCallback(() => setEndSummary(null), [])

    // ── Pusher: personal channel — incoming ring only (creator shells) ─────
    // Per-call events (accepted/ended/…) arrive on the conversation channel,
    // bound at call start in bindConversationChannel.
    useEffect(() => {
        if (!currentUserId || role !== "creator") return

        const pusher  = getPusherClient()
        const channel = pusher.subscribe(`private-user-${currentUserId}`)

        const onIncoming = (data: IncomingCall) => {
            if (phaseRef.current !== "idle") return // server busy-check makes this near-impossible
            setIncoming(data)
            startRingtone()
        }

        const onCancelled = (data: { callId: string }) => {
            if (incomingRef.current?.callId === data.callId) {
                stopRingtone()
                setIncoming(null)
            }
        }

        channel.bind("incoming-call",  onIncoming)
        channel.bind("call-cancelled", onCancelled)

        return () => {
            // Unbind OUR handlers only — this channel is shared with the
            // messaging components. Never unsubscribe or unbind_all here.
            channel.unbind("incoming-call",  onIncoming)
            channel.unbind("call-cancelled", onCancelled)
        }
    }, [currentUserId, role, startRingtone, stopRingtone])

    // Destroy the Daily object if the provider itself ever unmounts
    useEffect(() => () => { void teardownDaily() }, [teardownDaily])

    // ── Render ─────────────────────────────────────────────────────────────
    const value: CallContextValue = {
        phase, activeCall, incoming, endSummary,
        elapsedSeconds, lowBalance, isMuted, isCameraOff,
        localVideoTrack, remote,
        startCall, acceptIncoming, declineIncoming,
        hangUp, toggleMute, toggleCamera, dismissSummary,
    }

    return (
        <CallContext.Provider value={value}>
            {children}

            {incoming && <IncomingCallModal />}
            {(phase !== "idle" || endSummary) && <CallRoom />}
        </CallContext.Provider>
    )
}