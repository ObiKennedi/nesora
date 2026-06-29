import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import type { z } from "zod"

// ── Auth guard ────────────────────────────────────────────────────────────────
// Returns the authenticated user's ID or redirects to /login.

export async function requireAuth(): Promise<string> {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")
    return session.user.id
}

// ── Creator lookup ────────────────────────────────────────────────────────────
// Finds the Creator record for a given userId, redirecting to /onboarding
// if none exists. Most creator actions need this exact pattern.

export async function requireCreator(userId: string) {
    const creator = await prisma.creator.findUnique({ where: { userId } })
    if (!creator) redirect("/onboarding")
    return creator
}

// ── Schema validation ─────────────────────────────────────────────────────────
// Parses `data` against a Zod schema. Returns `{ data }` on success or
// `{ error }` with the first issue message on failure.

type ValidationResult<T> =
    | { success: true;  data: T;    error?: undefined }
    | { success: false; data?: undefined; error: string }

export function validateInput<T>(
    schema: z.ZodType<T>,
    data: unknown,
): ValidationResult<T> {
    const parsed = schema.safeParse(data)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }
    return { success: true, data: parsed.data }
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function paginationParams(params?: {
    page?: number
    limit?: number
}, defaultLimit = 20) {
    const page  = params?.page  ?? 1
    const limit = params?.limit ?? defaultLimit
    const skip  = (page - 1) * limit
    return { page, limit, skip }
}

export function paginatedResult<T>(
    items: T,
    total: number,
    page: number,
    limit: number,
) {
    return { ...items as object, total, pages: Math.ceil(total / limit), page } as
        T & { total: number; pages: number; page: number }
}

// ── Safe number coercion ──────────────────────────────────────────────────────
// Prisma aggregate results often return Decimal | null; this normalises them.

export function fmtNum(n: unknown): number {
    return Number(n ?? 0)
}
