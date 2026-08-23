// actions/onboarding/categories.ts
"use server"

import { auth }     from "@/lib/auth"
import { prisma }   from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Category } from "@prisma/client"
import { z }        from "zod"

const CategoriesSchema = z.object({
    categories: z.array(z.nativeEnum(Category)).min(1, "Pick at least one category").max(10, "Maximum 10 categories"),
})

export async function saveFanCategoriesAction(categories: Category[]) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = CategoriesSchema.safeParse({ categories })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    await prisma.userCategoryInterest.deleteMany({
        where: { userId: session.user.id },
    })
    await prisma.userCategoryInterest.createMany({
        data: parsed.data.categories.map((category) => ({
            userId: session.user.id,
            category,
        })),
    })

    redirect("/onboarding/fan/username")
}

export async function saveCreatorCategoriesAction(categories: Category[]) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = CategoriesSchema.safeParse({ categories })
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await prisma.creator.findUnique({
        where: { userId: session.user.id },
    })
    if (!creator) return { error: "Creator profile not found." }

    await prisma.creatorCategory.deleteMany({
        where: { creatorId: creator.id },
    })
    await prisma.creatorCategory.createMany({
        data: parsed.data.categories.map((category) => ({
            creatorId: creator.id,
            category,
        })),
    })

    redirect("/onboarding/creator/verify")
}