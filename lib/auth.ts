// lib/auth.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"

const baseAdapter = PrismaAdapter(prisma)

const customAdapter = {
    ...baseAdapter,
    async createUser(user: any) {
        const name = user.name || "User"
        const nameParts = name.trim().split(" ")
        const firstName = user.firstName || nameParts[0] || "User"
        const lastName = user.lastName || nameParts.slice(1).join(" ") || ""
        const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "") || "user"
        let username = user.username || `${base}${Math.floor(1000 + Math.random() * 9000)}`
        const conflict = await prisma.user.findUnique({ where: { username } })
        if (conflict) username = `${base}${Date.now().toString().slice(-6)}`

        return prisma.user.create({
            data: {
                name: user.name || `${firstName} ${lastName}`.trim(),
                email: user.email?.toLowerCase().trim() || user.email,
                image: user.image ?? null,
                firstName,
                lastName,
                username,
                emailVerified: user.emailVerified ?? new Date(),
                role: "USER",
                wallet: { create: { balance: 0 } },
            },
        })
    },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: customAdapter as any,
    ...authConfig,
})