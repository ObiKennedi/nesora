// actions/creator/notifications.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export async function getNotifications() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const notifications = await prisma.notification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
    })

    return notifications
}

export async function markAllRead() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
    })
}

export async function markOneRead(id: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    await prisma.notification.update({
        where: { id, userId: session.user.id },
        data: { read: true },
    })
}