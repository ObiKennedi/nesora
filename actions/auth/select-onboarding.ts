// actions/auth/select-onboarding.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/action-utils"
import { auth } from "@/lib/auth"
import { OnboardingType } from "@prisma/client"
import { redirect } from "next/navigation"

export async function selectOnboardingAction(type: OnboardingType) {
    const userId = await requireAuth()
    const session = await auth()

    await prisma.user.update({
        where: { id: userId },
        data: { onboardingType: type },
    })

    if (type === "CREATOR") {
        // Create the Creator record if it doesn't exist yet
        await prisma.creator.upsert({
            where: { userId },
            update: {},
            create: {
                userId,
                displayName: `${session?.user?.name ?? ""}`,
                wallet: { create: { balance: 0 } },
                // Give new creators a bonus points balance
                pointTransactions: {
                    create: {
                        points: 500,
                        type: "NEW_CREATOR_BONUS",
                        description: "Welcome bonus for joining NESORA as a creator.",
                    },
                },
            },
        })

        // Update points balance
        await prisma.creator.update({
            where: { userId },
            data: { pointsBalance: { increment: 500 } },
        })

        redirect("/onboarding/creator/handle")
    }

    redirect("/onboarding/fan/categories")
}