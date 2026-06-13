// actions/auth/creator-kyc.ts
"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { IdType } from "@prisma/client"
import { redirect } from "next/navigation"
import { z } from "zod"

const KYCSchema = z.object({
    dateOfBirth: z.string().min(1),
    idType: z.nativeEnum(IdType),
    idNumber: z.string().min(1),
    idFrontImage: z.string().min(1),
    idBackImage: z.string().min(1),
    bvnOrTaxId: z.string().optional(),
})

export async function submitKYCAction(formData: z.infer<typeof KYCSchema>) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = KYCSchema.safeParse(formData)
    if (!parsed.success) return { error: "Invalid fields." }

    const creator = await prisma.creator.findUnique({
        where: { userId: session.user.id },
    })
    if (!creator) return { error: "Creator profile not found." }

    await prisma.creatorVerification.upsert({
        where: { creatorId: creator.id },
        update: {
            ...parsed.data,
            dateOfBirth: new Date(parsed.data.dateOfBirth),
            status: "PENDING",
        },
        create: {
            creatorId: creator.id,
            ...parsed.data,
            dateOfBirth: new Date(parsed.data.dateOfBirth),
            status: "PENDING",
        },
    })

    await prisma.creator.update({
        where: { id: creator.id },
        data: { verificationStatus: "PENDING" },
    })

    return { success: true }
}

export async function skipKYCAction() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    // Creator stays unverified — just redirect to dashboard
    redirect("/creator/dashboard")
}