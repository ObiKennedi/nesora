// actions/creator/notifications.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/action-utils"
import { unstable_cache, revalidateTag } from "next/cache"

const fetchNotifications = unstable_cache(
    async (userId: string) => {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 30,
            select: {
                id: true,
                type: true,
                title: true,
                body: true,
                read: true,
                href: true,
                createdAt: true,
            },
        })
    },
    ["notifications"],
    {
        revalidate: 30,
        tags: ["notifications"],
    }
)

export async function getNotifications() {
    const userId = await requireAuth()
    return fetchNotifications(userId)
}

export async function markAllRead() {
    const userId = await requireAuth()

    await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
    })

    revalidateTag("notifications", {})  // ← no dynamic import needed
}

export async function markOneRead(id: string) {
    const userId = await requireAuth()

    await prisma.notification.update({
        where: { id, userId },
        data: { read: true },
    })

    revalidateTag("notifications", {})  // ← no dynamic import needed
}