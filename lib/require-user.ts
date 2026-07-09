// lib/require-user.ts
import "server-only"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export async function requireUser() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { id: true, isSuspended: true },
    })
    if (!user || user.isSuspended) redirect("/login?suspended=1")

    return session.user.id
}