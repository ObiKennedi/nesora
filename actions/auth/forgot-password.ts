// actions/auth/forgot-password.ts
"use server"

import { prisma } from "@/lib/prisma"
import { generatePasswordResetToken } from "@/lib/tokens"
import { sendPasswordResetEmail } from "@/lib/mail"
import bcrypt from "bcryptjs"
import { z } from "zod"

const ForgotSchema = z.object({
    email: z.email(),
})

const ResetSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(8),
})

export async function forgotPasswordAction(formData: z.infer<typeof ForgotSchema>) {
    const parsed = ForgotSchema.safeParse(formData)
    if (!parsed.success) return { error: "Invalid email." }

    const user = await prisma.user.findUnique({
        where: { email: parsed.data.email },
    })

    // Always return success — don't leak whether email exists
    if (!user) return { success: "If that email exists, a reset link has been sent." }

    try {
        const token = await generatePasswordResetToken(parsed.data.email)
        await sendPasswordResetEmail(parsed.data.email, token)
    } catch (err) {
        console.error("[forgot-password] Failed to send reset email:", err)
        return { error: "Something went wrong sending the reset email. Please try again." }
    }

    return { success: "If that email exists, a reset link has been sent." }
}

export async function resetPasswordAction(formData: z.infer<typeof ResetSchema>) {
    const parsed = ResetSchema.safeParse(formData)
    if (!parsed.success) return { error: "Invalid fields." }

    const { token, password } = parsed.data

    const record = await prisma.passwordResetToken.findUnique({
        where: { token },
    })

    if (!record) return { error: "Invalid or expired link." }
    if (record.expires < new Date()) return { error: "This link has expired." }

    const hashed = await bcrypt.hash(password, 12)

    try {
        await prisma.user.update({
            where: { email: record.email },
            data: { password: hashed },
        })

        await prisma.passwordResetToken.delete({ where: { token } })
    } catch (err) {
        console.error("[resetPassword] Failed to update password:", err)
        return { error: "Something went wrong resetting your password. Please try again." }
    }

    return { success: "Password updated. You can now log in." }
}