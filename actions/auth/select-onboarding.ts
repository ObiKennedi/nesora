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
            },
        })

        redirect("/onboarding/creator/handle")
    }

    redirect("/onboarding/fan/categories")
}