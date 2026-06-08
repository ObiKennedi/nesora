// actions/auth/login.ts
"use server"

import { signIn } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

const LoginSchema = z.object({
    email: z.email(),
    password: z.string().min(1),
})

export async function loginAction(formData: z.infer<typeof LoginSchema>) {
    const parsed = LoginSchema.safeParse(formData)
    if (!parsed.success) return { error: "Invalid fields." }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.password) return { error: "Invalid credentials." }

    if (!user.emailVerified) {
        return { error: "Please verify your email before logging in." }
    }

    try {
        await signIn("credentials", {
            email,
            password,
            redirect: false,
        })
    } catch (err) {
        if (err instanceof AuthError) {
            return { error: "Invalid credentials." }
        }
        throw err
    }

    // Redirect based on onboarding completion
    if (!user.onboardingType) redirect("/onboarding")

    redirect("/dashboard")
}