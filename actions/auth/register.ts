// actions/auth/register.ts
"use server"

import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/mail"
import { generateVerificationToken } from "@/lib/tokens"
import bcrypt from "bcryptjs"
import { z } from "zod"

const RegisterSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.email(),
    password: z.string().min(8),
})

export async function registerAction(formData: z.infer<typeof RegisterSchema>) {
    const parsed = RegisterSchema.safeParse(formData)
    if (!parsed.success) return { error: "Invalid fields." }

    const { firstName, lastName, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return { error: "An account with this email already exists." }

    // Build a unique username from name + random suffix
    const baseUsername = `${firstName}${lastName}`
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "")
    const suffix = Math.floor(1000 + Math.random() * 9000)
    const username = `${baseUsername}${suffix}`

    const hashed = await bcrypt.hash(password, 12)

    await prisma.user.create({
        data: {
            name: `${firstName} ${lastName}`.trim(),
            firstName,
            lastName,
            email,
            username,
            password: hashed,
            // Create wallet immediately
            wallet: { create: { balance: 0 } },
        },
    })

    const token = await generateVerificationToken(email)
    await sendVerificationEmail(email, token)

    return { success: "Account created. Check your email to verify." }
}