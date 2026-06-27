// actions/creator/handle.ts
"use server"

import { prisma }   from "@/lib/prisma"
import { requireAuth, validateInput } from "@/lib/action-utils"
import { auth }     from "@/lib/auth"
import { redirect } from "next/navigation"
import { z }        from "zod"

const HandleSchema = z.object({
    handle: z
        .string()
        .min(3, "Handle must be at least 3 characters")
        .max(30, "Handle must be 30 characters or less")
        .regex(
            /^[a-zA-Z0-9_]+$/,
            "Only letters, numbers, and underscores allowed"
        )
        .toLowerCase(),
})

export async function checkHandleAvailability(handle: string) {
    const result = validateInput(HandleSchema, { handle })
    if (!result.success) {
        return { available: false, error: result.error }
    }
    const parsed = result

    const session = await auth()

    const [existingUser, existingCreator] = await Promise.all([
        prisma.user.findUnique({
            where:  { username: parsed.data.handle },
            select: { id: true },
        }),
        prisma.creator.findUnique({
            where:  { handle: parsed.data.handle },
            select: { id: true },
        }),
    ])

    const userConflict    = existingUser    && existingUser.id !== session?.user?.id
    const creatorConflict = existingCreator

    return {
        available: !userConflict && !creatorConflict,
        error:     null,
    }
}

export async function saveCreatorHandleAction(handle: string) {
    const userId = await requireAuth()

    const result = validateInput(HandleSchema, { handle })
    if (!result.success) {
        return { error: result.error }
    }
    const parsed = result

    const [existingUser, existingCreator] = await Promise.all([
        prisma.user.findUnique({
            where:  { username: parsed.data.handle },
            select: { id: true },
        }),
        prisma.creator.findUnique({
            where:  { handle: parsed.data.handle },
            select: { id: true },
        }),
    ])

    if (existingUser && existingUser.id !== userId) {
        return { error: "This handle is already taken." }
    }
    if (existingCreator) {
        return { error: "This handle is already taken." }
    }

    const creator = await prisma.creator.findUnique({
        where: { userId },
    })
    if (!creator) return { error: "Creator profile not found." }

    await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data:  { username: parsed.data.handle },
        }),
        prisma.creator.update({
            where: { id: creator.id },
            data:  { handle: parsed.data.handle },
        }),
    ])

    redirect("/onboarding/creator/categories")
}