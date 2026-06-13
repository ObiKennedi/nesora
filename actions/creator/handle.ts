// actions/creator/handle.ts
"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z } from "zod"

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

// ── Check availability (called on-the-fly as user types) ──────────────────────
export async function checkHandleAvailability(handle: string) {
    const parsed = HandleSchema.safeParse({ handle })
    if (!parsed.success) {
        return { available: false, error: parsed.error.issues[0].message }
    }

    const existing = await prisma.creator.findUnique({
        where: { handle: parsed.data.handle },
        select: { id: true },
    })

    return { available: !existing, error: null }
}

// ── Save handle and redirect to categories ────────────────────────────────────
export async function saveCreatorHandleAction(handle: string) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = HandleSchema.safeParse({ handle })
    if (!parsed.success) {
        return { error: parsed.error.issues[0].message }
    }

    // Double-check availability
    const existing = await prisma.creator.findUnique({
        where: { handle: parsed.data.handle },
        select: { id: true },
    })
    if (existing) return { error: "This handle is already taken." }

    const creator = await prisma.creator.findUnique({
        where: { userId: session.user.id },
    })
    if (!creator) return { error: "Creator profile not found." }

    await prisma.creator.update({
        where: { id: creator.id },
        data: { handle: parsed.data.handle },
    })

    redirect("/onboarding/creator/categories")
}