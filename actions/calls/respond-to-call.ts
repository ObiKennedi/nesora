// actions/calls/respond-to-call.ts
"use server"

import { auth }                    from "@/lib/auth"
import { prisma }                  from "@/lib/prisma"
import { pusherServer }            from "@/lib/pusher"
import { redirect }                from "next/navigation"
import { createMeetingToken, deleteRoom } from "@/lib/daily"
import { finalizeUnansweredCall }  from "@/lib/calls"

export type RespondToCallResult =
    | { success: true; accepted: true; room: { url: string; token: string } }
    | { success: true; accepted: false }
    | { error: string }

export async function respondToCallAction(
    callId: string,
    accept: boolean,
): Promise<RespondToCallResult> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const call = await prisma.call.findUnique({
        where: { id: callId },
        include: {
            creator: { select: { userId: true, displayName: true } },
        },
    })
    if (!call)                                    return { error: "Call not found." }
    if (call.creator.userId !== session.user.id)  return { error: "Not authorized." }

    // ── Decline ────────────────────────────────────────────────────────────
    if (!accept) {
        const done = await finalizeUnansweredCall(callId, "DECLINED")
        if (!done) return { error: "This call is no longer ringing." }
        return { success: true, accepted: false }
    }

    // ── Accept: atomic claim RINGING → IN_PROGRESS ─────────────────────────
    // Loses gracefully to a concurrent fan-cancel or sweeper timeout.
    const claimed = await prisma.call.updateMany({
        where: { id: callId, status: "RINGING" },
        data:  { status: "IN_PROGRESS", startedAt: new Date() },
    })
    if (claimed.count === 0) return { error: "This call is no longer ringing." }

    let creatorToken: string
    try {
        creatorToken = await createMeetingToken({
            roomName: call.dailyRoomName,
            userId:   session.user.id,
            userName: call.creator.displayName,
            isOwner:  true,
        })
    } catch (err) {
        console.error("[calls] creator token failed:", err)
        // Roll the call into FAILED — the fan is told via the conversation channel
        await prisma.call.update({
            where: { id: callId },
            data:  { status: "FAILED", endedAt: new Date() },
        })
        await deleteRoom(call.dailyRoomName).catch(() => {})
        await pusherServer.trigger(
            `private-conversation-${call.conversationId}`,
            "call-failed",
            { callId },
        )
        return { error: "Couldn't join the call. Please try again." }
    }

    // Tell the fan's ringing screen to connect.
    // NOTE: tokens are never sent over Pusher — the fan already holds theirs
    // from initiateCallAction's return; this event carries only the signal.
    await pusherServer.trigger(
        `private-conversation-${call.conversationId}`,
        "call-accepted",
        { callId },
    )

    return {
        success:  true,
        accepted: true,
        room:     { url: call.dailyRoomUrl, token: creatorToken },
    }
}