// actions/onboarding/categories.ts
"use server"

import { prisma }   from "@/lib/prisma"
import { requireAuth, validateInput } from "@/lib/action-utils"
import { redirect } from "next/navigation"
import { Category } from "@prisma/client"
import { z }        from "zod"

const CategoriesSchema = z.object({
    categories: z.array(z.nativeEnum(Category)).min(1, "Pick at least one category").max(10, "Maximum 10 categories"),
})

export async function saveFanCategoriesAction(categories: Category[]) {
    const userId = await requireAuth()

    const result = validateInput(CategoriesSchema, { categories })
    if (!result.success) return { error: result.error }
    const parsed = result

    await prisma.$transaction([
        prisma.userCategoryInterest.deleteMany({
            where: { userId },
        }),
        prisma.userCategoryInterest.createMany({
            data: parsed.data.categories.map((category) => ({
                userId,
                category,
            })),
        }),
    ])

    redirect("/onboarding/fan/username")
}

export async function saveCreatorCategoriesAction(categories: Category[]) {
    const userId = await requireAuth()

    const result = validateInput(CategoriesSchema, { categories })
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await prisma.creator.findUnique({
        where: { userId },
    })
    if (!creator) return { error: "Creator profile not found." }

    await prisma.$transaction([
        prisma.creatorCategory.deleteMany({
            where: { creatorId: creator.id },
        }),
        prisma.creatorCategory.createMany({
            data: parsed.data.categories.map((category) => ({
                creatorId: creator.id,
                category,
            })),
        }),
    ])

    redirect("/onboarding/creator/verify")
}