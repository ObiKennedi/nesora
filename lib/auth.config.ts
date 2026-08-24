// lib/auth.config.ts
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import type { NextAuthConfig } from "next-auth"
import type { OnboardingType, Role } from "@prisma/client"

export default {
    trustHost: true,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt" },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
            profile(profile) {
                const firstName = (profile.given_name as string) ?? ""
                const lastName = (profile.family_name as string) ?? ""
                const name = `${firstName} ${lastName}`.trim()

                // Build a unique username from name + random suffix
                const baseUsername = `${firstName}${lastName}`
                    .toLowerCase()
                    .replace(/\s+/g, "")
                    .replace(/[^a-z0-9]/g, "")
                const suffix = Math.floor(1000 + Math.random() * 9000)
                const username = `${baseUsername}${suffix}`

                return {
                    id: profile.sub as string,
                    name,
                    firstName,
                    lastName,
                    email: profile.email as string,
                    image: profile.picture as string | null,
                    role: "USER" as Role,
                    onboardingType: null as OnboardingType | null,
                    username,
                    emailVerified: new Date(),
                }
            },
        }),
        Credentials({
            credentials: {
                email: { type: "email" },
                password: { type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                const email = String(credentials.email).trim().toLowerCase()
                const user = await prisma.user.findUnique({
                    where: { email },
                })

                if (!user || !user.password) return null
                if (!user.emailVerified) return null
                if (user.isSuspended) return null

                const valid = await bcrypt.compare(credentials.password as string, user.password)
                if (!valid) return null

                return {
                    id: user.id,
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    image: user.image,
                    role: user.role,
                    onboardingType: user.onboardingType,
                    username: user.username,
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user, account, trigger }) {
            if (user) {
                token.id = user.id as string
                token.role = user.role ?? "USER"
                token.onboardingType = user.onboardingType ?? null
                token.username = user.username ?? null
                token.image = user.image ?? null
            }

            if (account?.provider === "google" && (user?.id || user?.email)) {
                const cleanEmail = user.email ? String(user.email).trim().toLowerCase() : undefined
                const dbUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            ...(user.id ? [{ id: user.id }] : []),
                            ...(cleanEmail ? [{ email: cleanEmail }] : []),
                        ],
                    },
                    select: { id: true, role: true, onboardingType: true, username: true, image: true },
                })
                if (dbUser) {
                    token.id = dbUser.id
                    token.role = dbUser.role
                    token.onboardingType = dbUser.onboardingType ?? null
                    token.username = dbUser.username ?? null
                    token.image = dbUser.image ?? null
                }
            }

            if (trigger === "update" && token.id) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: token.id as string },
                    select: { role: true, onboardingType: true, username: true, image: true },
                })
                if (dbUser) {
                    token.role = dbUser.role
                    token.onboardingType = dbUser.onboardingType ?? null
                    token.username = dbUser.username ?? null
                    token.image = dbUser.image ?? null
                }
            }

            return token
        },
        async session({ session, token }) {
            session.user.id = token.id as string
            session.user.role = token.role as Role
            session.user.onboardingType = token.onboardingType as OnboardingType | null
            session.user.username = token.username as string | null
            session.user.image = token.image as string | null
            return session
        },
        async signIn({ user, account }) {
            if (account?.provider === "google") return true

            if (account?.provider === "credentials") {
                if (!user.email) return false
                const email = String(user.email).trim().toLowerCase()
                const dbUser = await prisma.user.findUnique({
                    where: { email },
                    select: { emailVerified: true, isSuspended: true },
                })
                return Boolean(dbUser?.emailVerified && !dbUser?.isSuspended)
            }
            return true
        },
        async redirect({ url, baseUrl }) {
            if (url.startsWith("/")) return `${baseUrl}${url}`
            if (url.startsWith(baseUrl)) return url
            return baseUrl
        },
    },
    pages: {
        signIn: "/login",
        error: "/error",
        newUser: "/onboarding",
        verifyRequest: "/verify-email",
    },
    debug: process.env.NODE_ENV === "development",
} satisfies NextAuthConfig