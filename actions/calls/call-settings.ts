// actions/creator/call-settings.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { z }        from "zod"
import { Prisma }   from "@prisma/client"

async function getCreatorOrThrow(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) redirect("/onboarding")
    return creator
}

// ── Get ───────────────────────────────────────────────────────────────────────

export async function getCallSettingsAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    return {
        voiceCallsEnabled:   creator.voiceCallsEnabled,
        videoCallsEnabled:   creator.videoCallsEnabled,
        voiceCallRate:       creator.voiceCallRate ? Number(creator.voiceCallRate) : null,
        videoCallRate:       creator.videoCallRate ? Number(creator.videoCallRate) : null,
        availableForCalls:   creator.availableForCalls,
        topFanFreeCallCount: creator.topFanFreeCallCount,
    }
}

// ── Update ────────────────────────────────────────────────────────────────────

const CallSettingsSchema = z.object({
    voiceCallsEnabled: z.boolean(),
    videoCallsEnabled: z.boolean(),

    // ₦ per hour; null or 0 ⇒ free. Capped well under Decimal(10,2)'s range.
    voiceCallRate: z.number().min(0).max(1_000_000).nullable(),
    videoCallRate: z.number().min(0).max(1_000_000).nullable(),

    availableForCalls: z.boolean(),

    // Top-fan pool is cached at 100 (see lib/top-fans.ts) — N can't exceed it
    topFanFreeCallCount: z.number().int().min(0).max(100),
})

export type UpdateCallSettingsResult =
    | { success: true }
    | { error: string }

export async function updateCallSettingsAction(
    data: z.infer<typeof CallSettingsSchema>,
): Promise<UpdateCallSettingsResult> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const parsed = CallSettingsSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }
    const s = parsed.data

    await prisma.creator.update({
        where: { id: creator.id },
        data: {
            voiceCallsEnabled: s.voiceCallsEnabled,
            videoCallsEnabled: s.videoCallsEnabled,
            voiceCallRate:     s.voiceCallRate !== null
                ? new Prisma.Decimal(s.voiceCallRate)
                : null,
            videoCallRate:     s.videoCallRate !== null
                ? new Prisma.Decimal(s.videoCallRate)
                : null,
            availableForCalls:   s.availableForCalls,
            topFanFreeCallCount: s.topFanFreeCallCount,
        },
    })

    return { success: true }
}