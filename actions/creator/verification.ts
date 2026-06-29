// actions/creator/verification.ts
"use server"

import { prisma }   from "@/lib/prisma"
import { requireAuth, requireCreator, validateInput } from "@/lib/action-utils"
import { z }        from "zod"
import { IdType }   from "@prisma/client"

// ── Get verification status ───────────────────────────────────────────────────

export async function getVerificationStatusAction() {
    const userId = await requireAuth()

    const creator = await requireCreator(userId)

    const [verification, user] = await Promise.all([
        prisma.creatorVerification.findUnique({
            where: { creatorId: creator.id },
        }),
        prisma.user.findUnique({
            where:  { id: userId },
            select: {
                dateOfBirth: true,
                gender:      true,
                country:     true,
                city:        true,
                image:       true,
                firstName:   true,
                lastName:    true,
                username:    true,
            },
        }),
    ])

    // ── Calculate verification progress ───────────────────────────────────────
    const steps = {
        identityDocument: !!verification?.idFrontImage && !!verification?.idBackImage,
        selfie:           !!verification?.selfieImage,
        address:          !!verification?.addressProofImage,
        personalInfo:     !!verification?.dateOfBirth,
    }
    const completedSteps = Object.values(steps).filter(Boolean).length
    const progress        = Math.round((completedSteps / 4) * 100)

    // ── Calculate creator trust score ─────────────────────────────────────────
    const trustScore = await calculateTrustScore(creator.id, verification?.status ?? "PENDING")

    return {
        verification,
        steps,
        progress,
        trustScore,
        creator: {
            isVerified:         creator.isVerified,
            verificationStatus: creator.verificationStatus,
        },
        profile: user,
    }
}

// ── Trust score calculation ───────────────────────────────────────────────────

async function calculateTrustScore(creatorId: string, verifStatus: string) {
    const [followersCount, subscribersCount, postsCount, accountAgeDays] = await Promise.all([
        prisma.follow.count({ where: { creatorId } }),
        prisma.subscription.count({ where: { creatorId, status: "ACTIVE" } }),
        prisma.post.count({ where: { creatorId, status: "PUBLISHED" } }),
        prisma.creator.findUnique({
            where:  { id: creatorId },
            select: { createdAt: true },
        }).then((c) => c ? Math.floor((Date.now() - c.createdAt.getTime()) / 86_400_000) : 0),
    ])

    let score = 0
    score += verifStatus === "APPROVED" ? 40 : verifStatus === "PENDING" ? 10 : 0
    score += Math.min(followersCount / 10, 20)        // up to 20 pts
    score += Math.min(subscribersCount * 2, 20)        // up to 20 pts
    score += Math.min(postsCount, 10)                  // up to 10 pts
    score += Math.min(accountAgeDays / 30, 10)         // up to 10 pts

    return Math.min(Math.round(score), 100)
}

// ── Update personal info (DOB, gender, location) ─────────────────────────────

const PersonalInfoSchema = z.object({
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender:      z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
    country:     z.string().min(1, "Country is required"),
    city:        z.string().optional(),
})

export async function updatePersonalInfoAction(
    data: z.infer<typeof PersonalInfoSchema>
) {
    const userId = await requireAuth()

    const result = validateInput(PersonalInfoSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    await prisma.user.update({
        where: { id: userId },
        data: {
            dateOfBirth: new Date(parsed.data.dateOfBirth),
            gender:      parsed.data.gender,
            country:     parsed.data.country,
            city:        parsed.data.city,
        },
    })

    return { success: true }
}

// ── Submit/update identity documents ──────────────────────────────────────────

const IdentitySchema = z.object({
    idType:       z.nativeEnum(IdType),
    idNumber:     z.string().min(1),
    idFrontImage: z.string().min(1),
    idBackImage:  z.string().min(1),
    bvnOrTaxId:   z.string().optional(),
})

export async function submitIdentityDocumentsAction(
    data: z.infer<typeof IdentitySchema>
) {
    const userId = await requireAuth()

    const result = validateInput(IdentitySchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await requireCreator(userId)

    const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: { dateOfBirth: true },
    })
    if (!user?.dateOfBirth) {
        return { error: "Please complete personal information first." }
    }

    await prisma.creatorVerification.upsert({
        where: { creatorId: creator.id },
        update: {
            idType:       parsed.data.idType,
            idNumber:     parsed.data.idNumber,
            idFrontImage: parsed.data.idFrontImage,
            idBackImage:  parsed.data.idBackImage,
            bvnOrTaxId:   parsed.data.bvnOrTaxId,
            status:       "PENDING",
            rejectionReason: null,
        },
        create: {
            creatorId:    creator.id,
            dateOfBirth:  user.dateOfBirth,
            idType:       parsed.data.idType,
            idNumber:     parsed.data.idNumber,
            idFrontImage: parsed.data.idFrontImage,
            idBackImage:  parsed.data.idBackImage,
            bvnOrTaxId:   parsed.data.bvnOrTaxId,
            status:       "PENDING",
        },
    })

    await prisma.creator.update({
        where: { id: creator.id },
        data:  { verificationStatus: "PENDING" },
    })

    await notifyAdminsOfSubmission(creator.id, "identity document")

    return { success: true }
}

// ── Submit selfie ──────────────────────────────────────────────────────────────

export async function submitSelfieAction(selfieImage: string) {
    const userId = await requireAuth()

    if (!selfieImage) return { error: "Selfie image is required." }

    const creator = await requireCreator(userId)

    const existing = await prisma.creatorVerification.findUnique({
        where: { creatorId: creator.id },
    })
    if (!existing) return { error: "Submit identity documents first." }

    await prisma.creatorVerification.update({
        where: { creatorId: creator.id },
        data: {
            selfieImage,
            selfieVerified: false, // requires admin review
            status:         "PENDING",
            rejectionReason: null,
        },
    })

    await notifyAdminsOfSubmission(creator.id, "selfie")

    return { success: true }
}

// ── Submit address verification ───────────────────────────────────────────────

const AddressSchema = z.object({
    addressLine:       z.string().min(1, "Address is required"),
    addressCity:       z.string().min(1, "City is required"),
    addressState:      z.string().min(1, "State is required"),
    addressCountry:    z.string().min(1, "Country is required"),
    addressProofImage: z.string().min(1, "Proof of address is required"),
})

export async function submitAddressAction(
    data: z.infer<typeof AddressSchema>
) {
    const userId = await requireAuth()

    const result = validateInput(AddressSchema, data)
    if (!result.success) return { error: result.error }
    const parsed = result

    const creator = await requireCreator(userId)

    const existing = await prisma.creatorVerification.findUnique({
        where: { creatorId: creator.id },
    })
    if (!existing) return { error: "Submit identity documents first." }

    await prisma.creatorVerification.update({
        where: { creatorId: creator.id },
        data: {
            ...parsed.data,
            addressVerified: false, // requires admin review
            status:          "PENDING",
            rejectionReason: null,
        },
    })

    await notifyAdminsOfSubmission(creator.id, "address proof")

    return { success: true }
}

// ── Helper: notify admins ────────────────────────────────────────────────────

async function notifyAdminsOfSubmission(creatorId: string, docType: string) {
    const [creator, admins] = await Promise.all([
        prisma.creator.findUnique({
            where:  { id: creatorId },
            select: { displayName: true },
        }),
        prisma.user.findMany({
            where:  { role: "ADMIN" },
            select: { id: true },
        }),
    ])

    await prisma.notification.createMany({
        data: admins.map((admin) => ({
            userId: admin.id,
            type:   "VERIFICATION_UPDATE" as const,
            title:  "New verification submission",
            body:   `${creator?.displayName ?? "A creator"} submitted ${docType} for review.`,
            href:   "/admin/verifications",
        })),
    })
}