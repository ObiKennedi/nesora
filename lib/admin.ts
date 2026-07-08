// lib/admin.ts
import "server-only"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import type { Prisma } from "@prisma/client"

/**
 * DB-backed admin check. Never trust the JWT alone for admin actions —
 * role could have been revoked or the account suspended since token issue.
 */
export async function requireAdmin() {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const user = await prisma.user.findUnique({
        where:  { id: session.user.id },
        select: { id: true, role: true, isSuspended: true, firstName: true },
    })

    if (!user || user.role !== "ADMIN" || user.isSuspended) {
        redirect("/dashboard")
    }

    return user
}

type AuditParams = {
    adminId:    string
    action:     string // "withdrawal.approve" | "withdrawal.reject" | "kyc.approve" | "kyc.reject" | "user.suspend" | ...
    targetType: "Withdrawal" | "CreatorVerification" | "User" | "Creator"
    targetId:   string
    metadata?:  Prisma.InputJsonValue
}

/** Pass tx when logging inside a transaction so the log commits atomically. */
export function logAdminAction(
    { adminId, action, targetType, targetId, metadata }: AuditParams,
    tx: Pick<typeof prisma, "auditLog"> = prisma,
) {
    return tx.auditLog.create({
        data: { adminId, action, targetType, targetId, metadata },
    })
}