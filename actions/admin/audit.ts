// actions/admin/audit.ts
"use server"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin"

export async function getAuditLogAction(params?: {
    category?: "all" | "withdrawal" | "kyc" | "user"
    adminId?:  string
    targetId?: string
    page?:     number
    limit?:    number
}) {
    await requireAdmin()

    const page     = params?.page  ?? 1
    const limit    = params?.limit ?? 30
    const skip     = (page - 1) * limit
    const category = params?.category ?? "all"
    const targetId = params?.targetId?.trim()

    const where = {
        ...(category !== "all" ? { action: { startsWith: `${category}.` } } : {}),
        ...(params?.adminId ? { adminId: params.adminId } : {}),
        ...(targetId ? { targetId } : {}),
    }

    const [entries, total, admins] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                admin: {
                    select: { id: true, firstName: true, lastName: true, email: true, image: true },
                },
            },
        }),
        prisma.auditLog.count({ where }),
        // For the admin filter dropdown
        prisma.user.findMany({
            where:  { role: "ADMIN" },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: "asc" },
        }),
    ])

    return {
        entries,
        total,
        pages: Math.ceil(total / limit),
        page,
        admins,
    }
}