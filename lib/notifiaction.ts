import { prisma }           from "@/lib/prisma"
import { pusherServer }     from "@/lib/pusher"
import { revalidateTag }    from "next/cache"
import { NotificationType } from "@prisma/client"

export const notificationsTag = (userId: string) => `notifications-${userId}`

type CreateNotificationParams = {
    userId: string
    type:   NotificationType
    title:  string
    body:   string
    href?:  string
    pusher?: boolean
}

export async function createNotification(params: CreateNotificationParams) {
    const notification = await prisma.notification.create({
        data: {
            userId: params.userId,
            type:   params.type,
            title:  params.title,
            body:   params.body,
            href:   params.href,
        },
    })

    try {
        revalidateTag(notificationsTag(params.userId), {})
    } catch {
    }

    if (params.pusher !== false) {
        try {
            await pusherServer.trigger(
                `private-user-${params.userId}`,
                "notification",
                {
                    id:        notification.id,
                    type:      notification.type,
                    title:     notification.title,
                    body:      notification.body,
                    href:      notification.href,
                    createdAt: notification.createdAt,
                },
            )
        } catch {
            // Pusher failure must never fail the caller's flow —
            // the row exists; the bell catches up on next fetch.
        }
    }

    return notification
}