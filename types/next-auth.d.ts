import "next-auth"
import "next-auth/jwt"
import { Role, OnboardingType } from "@prisma/client"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            email: string
            name: string | null
            image: string | null
            role: Role
            onboardingType: OnboardingType | null
            username: string | null
        }
    }

    interface User {
        role: Role
        onboardingType: OnboardingType | null
        username: string | null
        password?: string | null
        emailVerified?: Date | null
        firstName?: string | null
        lastName?: string | null
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id: string
        role: Role
        onboardingType: OnboardingType | null
        username: string | null
    }
}