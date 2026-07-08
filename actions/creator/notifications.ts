"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
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
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    return fetchNotifications(session.user.id)
}

export async function markAllRead() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    await prisma.notification.updateMany({
        where: { userId: session.user.id, read: false },
        data: { read: true },
    })

    revalidateTag("notifications", {}) 
}

export async function markOneRead(id: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    await prisma.notification.update({
        where: { id, userId: session.user.id },
        data: { read: true },
    })

    revalidateTag("notifications", {})  // ← no dynamic import needed
}