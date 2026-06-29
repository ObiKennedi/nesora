"use server"

import { prisma }   from "@/lib/prisma"
import { requireAuth, validateInput } from "@/lib/action-utils"
import { auth }     from "@/lib/auth"
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

// ── Check availability ────────────────────────────────────────────────────────
// Checks both user.username and creator.handle to prevent collisions
// A fan cannot claim a username already taken by a creator's handle

export async function checkFanUsernameAvailability(username: string) {
    const result = validateInput(UsernameSchema, { username })
    if (!result.success) {
        return { available: false, error: result.error }
    }
    const parsed = result

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

    // Exclude current user's own username from conflict check
    const userConflict    = existingUser    && existingUser.id !== session?.user?.id
    const creatorConflict = !!existingCreator

    return {
        available: !userConflict && !creatorConflict,
        error:     null,
    }
}

// ── Save username ─────────────────────────────────────────────────────────────
// Fans only write to user.username — no creator.handle to sync

export async function saveFanUsernameAction(username: string) {
    const userId = await requireAuth()

    const result = validateInput(UsernameSchema, { username })
    if (!result.success) {
        return { error: result.error }
    }
    const parsed = result

    // Double-check conflicts at write time
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

    if (existingUser && existingUser.id !== userId) {
        return { error: "This username is already taken." }
    }
    if (existingCreator) {
        return { error: "This username is already taken." }
    }

    await prisma.user.update({
        where: { id: userId },
        data:  { username: parsed.data.username },
    })

    redirect("/onboarding/fan/who-to-follow")
}