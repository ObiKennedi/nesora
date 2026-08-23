// actions/auth/login.ts
"use server"

import { signIn } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { redirect } from "next/navigation"
import { AuthError } from "next-auth"

const LoginSchema = z.object({
    email: z.string().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
})

export async function loginAction(formData: z.infer<typeof LoginSchema>) {
    const parsed = LoginSchema.safeParse(formData)
    if (!parsed.success) return { error: "Invalid fields." }

    const { email, password } = parsed.data
    const cleanEmail = email.trim().toLowerCase()

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } })
    if (!user || !user.password) return { error: "Invalid credentials." }

    if (!user.emailVerified) {
        return { error: "Please verify your email before logging in." }
    }

    if (user.isSuspended) {
        return { error: "Your account has been suspended. Please contact support." }
    }

    try {
        await signIn("credentials", {
            email: cleanEmail,
            password,
            redirect: false,
        })
    } catch (err) {
        if (err instanceof AuthError) {
            switch (err.type) {
                case "CredentialsSignin":
                    return { error: "Invalid credentials." }
                default:
                    return { error: "Authentication failed. Please try again." }
            }
        }
        throw err
    }

    // Redirect based on onboarding completion
    if (!user.onboardingType) redirect("/onboarding")

    redirect("/dashboard")
}