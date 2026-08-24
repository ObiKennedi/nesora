// lib/auth.ts
import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"

const baseAdapter = PrismaAdapter(prisma)

const customAdapter = {
    ...baseAdapter,
    createSession: () => null,
    getSessionAndUser: () => null,
    updateSession: () => null,
    deleteSession: () => null,
    async getUser(id: string) {
        if (!id) return null
        return prisma.user.findUnique({ where: { id } })
    },
    async getUserByEmail(email: string) {
        if (!email) return null
        return prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
        })
    },
    async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
        const account = await prisma.account.findUnique({
            where: {
                provider_providerAccountId: {
                    provider,
                    providerAccountId,
                },
            },
            include: { user: true },
        })
        return account?.user ?? null
    },
    async linkAccount(account: any) {
        return prisma.account.create({
            data: {
                userId: account.userId,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token ?? null,
                access_token: account.access_token ?? null,
                expires_at: account.expires_at ? Number(account.expires_at) : null,
                token_type: account.token_type ?? null,
                scope: account.scope ?? null,
                id_token: account.id_token ?? null,
                session_state: account.session_state ?? null,
            },
        })
    },
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
    ...authConfig,
    adapter: customAdapter as any,
})