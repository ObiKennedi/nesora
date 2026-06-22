// app/api/pusher/auth/route.ts
import { NextRequest, NextResponse } from "next/server"
import { pusherServer }              from "@/lib/pusher"
import { auth }                      from "@/lib/auth"

export async function POST(req: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body         = await req.text()
    const params       = new URLSearchParams(body)
    const socketId     = params.get("socket_id")!
    const channelName  = params.get("channel_name")!

    // Only allow users to auth for their own private channels
    // Channel format: private-user-{userId}
    // or private-conversation-{conversationId}
    const isOwnChannel = channelName === `private-user-${session.user.id}`
    const isConvChannel = channelName.startsWith("private-conversation-")

    if (!isOwnChannel && !isConvChannel) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // For conversation channels, verify membership
    if (isConvChannel) {
        const conversationId = channelName.replace("private-conversation-", "")
        const { prisma }     = await import("@/lib/prisma")

        const conversation = await prisma.conversation.findFirst({
            where: {
                id: conversationId,
                OR: [
                    { creator:    { userId: session.user.id } },
                    { subscriberId: session.user.id           },
                ],
            },
        })

        if (!conversation) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
    }

    const userData = {
        user_id:   session.user.id,
        user_info: { name: session.user.name },
    }

    const authResponse = pusherServer.authorizeChannel(
        socketId,
        channelName,
        userData
    )

    return NextResponse.json(authResponse)
}