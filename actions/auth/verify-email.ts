"use server"

import { verifyEmailToken } from "@/lib/tokens"
import { redirect } from "next/navigation"

export async function verifyEmailAction(token: string) {
    if (!token) return { error: "Missing token." }

    const result = await verifyEmailToken(token)

    if (result.error) return { error: result.error }

    redirect("/login?verified=true")
}