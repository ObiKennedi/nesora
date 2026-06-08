// actions/auth/select-onboarding.ts
"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { OnboardingType } from "@prisma/client"
import { redirect } from "next/navigation"

export async function selectOnboardingAction(type: OnboardingType) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    await prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingType: type },
    })

    if (type === "CREATOR") {
        // Create the Creator record if it doesn't exist yet
        await prisma.creator.upsert({
            where: { userId: session.user.id },
            update: {},
            create: {
                userId: session.user.id,
                displayName: `${session.user.name}`,
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
            where: { userId: session.user.id },
            data: { pointsBalance: { increment: 500 } },
        })

        redirect("/onboarding/verify")
    }

    // Fan — go straight to dashboard
    redirect("/dashboard")
}