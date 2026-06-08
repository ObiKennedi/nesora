// lib/tokens.ts
import { prisma } from "@/lib/prisma"
import crypto from "crypto"

// ── Verification token ────────────────────────────────────────────────────────

export async function generateVerificationToken(email: string) {
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h

    await prisma.verificationToken.upsert({
        where: { identifier_token: { identifier: email, token: "" } },
        update: { token, expires },
        create: { identifier: email, token, expires },
    }).catch(async () => {
        // If no existing row, just create
        await prisma.verificationToken.create({
            data: { identifier: email, token, expires },
        })
    })

    return token
}

export async function verifyEmailToken(token: string) {
    const record = await prisma.verificationToken.findFirst({
        where: { token },
    })

    if (!record) return { error: "Invalid token." }
    if (record.expires < new Date()) return { error: "Token expired." }

    await prisma.user.update({
        where: { email: record.identifier },
        data: { emailVerified: new Date() },
    })

    await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: record.identifier, token } },
    })

    return { success: true }
}

// ── Password reset token ──────────────────────────────────────────────────────

export async function generatePasswordResetToken(email: string) {
    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 1000 * 60 * 60) // 1h

    await prisma.passwordResetToken.upsert({
        where: { email },
        update: { token, expires },
        create: { email, token, expires },
    })

    return token
}

export async function verifyPasswordResetToken(token: string) {
    const record = await prisma.passwordResetToken.findUnique({
        where: { token },
    })

    if (!record) return { error: "Invalid token." }
    if (record.expires < new Date()) return { error: "Token expired." }

    return { success: true, email: record.email }
}