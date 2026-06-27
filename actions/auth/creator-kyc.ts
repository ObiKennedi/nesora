// actions/auth/creator-kyc.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAuth, validateInput } from "@/lib/action-utils"
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
    const userId = await requireAuth()

    const result = validateInput(KYCSchema, formData)
    if (!result.success) return { error: "Invalid fields." }
    const parsed = result

    const creator = await prisma.creator.findUnique({
        where: { userId },
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
    await requireAuth()

    // Creator stays unverified — just redirect to dashboard
    redirect("/creator/dashboard")
}