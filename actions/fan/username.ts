"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"

const UsernameSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(30, "Username must be 30 characters or less")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Only letters, numbers, and underscores allowed"
        )
        .toLowerCase(),
})

export async function checkFanUsernameAvailability(username: string) {
    const parsed = UsernameSchema.safeParse({ username })
    if (!parsed.success) {
        return { available: false, error: parsed.error.issues[0].message }
    }

    const session = await auth()

    const [existingUser, existingCreator] = await Promise.all([
        prisma.user.findUnique({
            where:  { username: parsed.data.username },
            select: { id: true },
        }),
        prisma.creator.findUnique({
            where:  { handle: parsed.data.username },
            select: { id: true },
        }),
    ])

    const userConflict    = existingUser    && existingUser.id !== session?.user?.id
    const creatorConflict = !!existingCreator

    return {
        available: !userConflict && !creatorConflict,
        error:     null,
    }
}

export async function saveFanUsernameAction(username: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = UsernameSchema.safeParse({ username })
    if (!parsed.success) {
        return { error: parsed.error.issues[0].message }
    }

    const [existingUser, existingCreator] = await Promise.all([
        prisma.user.findUnique({
            where:  { username: parsed.data.username },
            select: { id: true },
        }),
        prisma.creator.findUnique({
            where:  { handle: parsed.data.username },
            select: { id: true },
        }),
    ])

    if (existingUser && existingUser.id !== session.user.id) {
        return { error: "This username is already taken." }
    }
    if (existingCreator) {
        return { error: "This username is already taken." }
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data:  { username: parsed.data.username },
    })

    redirect("/onboarding/fan/who-to-follow")
}