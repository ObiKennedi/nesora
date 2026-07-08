// actions/creator/wallet.ts
"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfDay,
  subDays,
} from "date-fns";

async function getCreatorOrThrow(userId: string) {
  const creator = await prisma.creator.findUnique({
    where: { userId },
  });
  if (!creator) redirect("/onboarding");
  return creator;
}

const fmtNum = (n: any) => Number(n ?? 0);

// ── Wallet overview ───────────────────────────────────────────────────────────

export async function getWalletOverviewAction() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creator = await getCreatorOrThrow(session.user.id);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const lastMonth = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    wallet,
    pendingPayouts,

    // This month
    subsThisMonth,
    giftsThisMonth,
    tipsThisMonth,

    // Last month (for trend)
    subsLastMonth,
    giftsLastMonth,
    tipsLastMonth,

    // All time
    allTimeSubs,
    allTimeGifts,
    allTimeTips,
    allTimeWithdrawals,
  ] = await Promise.all([
    // Wallet balance
    prisma.creatorWallet.findUnique({
      where: { creatorId: creator.id },
      select: { balance: true },
    }),

    // Pending payouts
    prisma.withdrawal.aggregate({
      where: { creatorId: creator.id, status: "PENDING" },
      _sum: { netAmount: true },
    }),

    // Subscriptions this month
    prisma.subscription.aggregate({
      where: {
        creatorId: creator.id,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amountPaid: true },
    }),

    // Gifts this month
    prisma.giftTransaction.aggregate({
      where: {
        creatorId: creator.id,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),

    // Tips this month
    prisma.tip.aggregate({
      where: {
        creatorId: creator.id,
        createdAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),

    // Last month comparisons
    prisma.subscription.aggregate({
      where: {
        creatorId: creator.id,
        createdAt: { gte: lastMonth, lte: lastMonthEnd },
      },
      _sum: { amountPaid: true },
    }),

    prisma.giftTransaction.aggregate({
      where: {
        creatorId: creator.id,
        createdAt: { gte: lastMonth, lte: lastMonthEnd },
      },
      _sum: { amount: true },
    }),

    prisma.tip.aggregate({
      where: {
        creatorId: creator.id,
        createdAt: { gte: lastMonth, lte: lastMonthEnd },
      },
      _sum: { amount: true },
    }),

    // All time
    prisma.subscription.aggregate({
      where: { creatorId: creator.id },
      _sum: { amountPaid: true },
    }),

    prisma.giftTransaction.aggregate({
      where: { creatorId: creator.id },
      _sum: { amount: true },
    }),

    prisma.tip.aggregate({
      where: { creatorId: creator.id },
      _sum: { amount: true },
    }),

    prisma.withdrawal.aggregate({
      where: { creatorId: creator.id, status: "PAID" },
      _sum: { netAmount: true },
    }),
  ]);

  const thisMonthTotal =
    fmtNum(subsThisMonth._sum.amountPaid) +
    fmtNum(giftsThisMonth._sum.amount) +
    fmtNum(tipsThisMonth._sum.amount);

  const lastMonthTotal =
    fmtNum(subsLastMonth._sum.amountPaid) +
    fmtNum(giftsLastMonth._sum.amount) +
    fmtNum(tipsLastMonth._sum.amount);

  const trend =
    lastMonthTotal === 0
      ? 100
      : ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;

  const allTimeEarnings =
    fmtNum(allTimeSubs._sum.amountPaid) +
    fmtNum(allTimeGifts._sum.amount) +
    fmtNum(allTimeTips._sum.amount);

  return {
    isVerified:         creator.isVerified,
    verificationStatus: creator.verificationStatus,
    balance: fmtNum(wallet?.balance),
    pendingPayouts: fmtNum(pendingPayouts._sum.netAmount),
    thisMonthTotal,
    lastMonthTotal,
    trend: Math.round(trend),
    allTimeEarnings,
    allTimeWithdrawn: fmtNum(allTimeWithdrawals._sum.netAmount),

    // Revenue breakdown this month
    breakdown: {
      subscriptions: fmtNum(subsThisMonth._sum.amountPaid),
      gifts: fmtNum(giftsThisMonth._sum.amount),
      tips: fmtNum(tipsThisMonth._sum.amount),
      messages: 0, // paid messages — add when built
      content: 0, // content purchases — add when built
    },
  };
}

// ── Revenue chart data (last 6 months) ───────────────────────────────────────

export async function getRevenueChartAction() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creator = await getCreatorOrThrow(session.user.id);

  const months = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    return {
      label: date.toLocaleDateString("en-NG", { month: "short" }),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  });

  const data = await Promise.all(
    months.map(async ({ label, start, end }) => {
      const [subs, gifts, tips] = await Promise.all([
        prisma.subscription.aggregate({
          where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
          _sum: { amountPaid: true },
        }),
        prisma.giftTransaction.aggregate({
          where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
        prisma.tip.aggregate({
          where: { creatorId: creator.id, createdAt: { gte: start, lte: end } },
          _sum: { amount: true },
        }),
      ]);

      return {
        month: label,
        subscriptions: fmtNum(subs._sum.amountPaid),
        gifts: fmtNum(gifts._sum.amount),
        tips: fmtNum(tips._sum.amount),
        total:
          fmtNum(subs._sum.amountPaid) +
          fmtNum(gifts._sum.amount) +
          fmtNum(tips._sum.amount),
      };
    }),
  );

  return data;
}

// ── Transaction history ───────────────────────────────────────────────────────

export async function getTransactionHistoryAction(params?: {
  page?: number;
  limit?: number;
  type?: "all" | "subscriptions" | "gifts" | "tips" | "withdrawals";
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creator = await getCreatorOrThrow(session.user.id);

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const skip = (page - 1) * limit;
  const type = params?.type ?? "all";

  const transactions: any[] = [];

  if (type === "all" || type === "subscriptions") {
    const subs = await prisma.subscription.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: type === "subscriptions" ? limit : 50,
      select: {
        id: true,
        amountPaid: true,
        createdAt: true,
        user: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    transactions.push(
      ...subs.map((s) => ({
        id: s.id,
        type: "subscription",
        amount: fmtNum(s.amountPaid),
        label: `Subscription from ${s.user.firstName ?? s.user.username ?? "Fan"}`,
        createdAt: s.createdAt,
        positive: true,
      })),
    );
  }

  if (type === "all" || type === "gifts") {
    const gifts = await prisma.giftTransaction.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: type === "gifts" ? limit : 50,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        gift: { select: { name: true } },
        sender: { select: { firstName: true, username: true } },
      },
    });
    transactions.push(
      ...gifts.map((g) => ({
        id: g.id,
        type: "gift",
        amount: fmtNum(g.amount),
        label: `${g.gift.name} gift from ${g.sender.firstName ?? g.sender.username ?? "Fan"}`,
        createdAt: g.createdAt,
        positive: true,
      })),
    );
  }

  if (type === "all" || type === "tips") {
    const tips = await prisma.tip.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: type === "tips" ? limit : 50,
      select: {
        id: true,
        amount: true,
        message: true,
        createdAt: true,
        fromUser: { select: { firstName: true, username: true } },
      },
    });
    transactions.push(
      ...tips.map((t) => ({
        id: t.id,
        type: "tip",
        amount: fmtNum(t.amount),
        label: `Tip from ${t.fromUser.firstName ?? t.fromUser.username ?? "Fan"}${t.message ? ` · "${t.message}"` : ""}`,
        createdAt: t.createdAt,
        positive: true,
      })),
    );
  }

  if (type === "all" || type === "withdrawals") {
    const withdrawals = await prisma.withdrawal.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: type === "withdrawals" ? limit : 50,
      select: {
        id: true,
        netAmount: true,
        status: true,
        createdAt: true,
        bankAccount: { select: { bankName: true, accountName: true } },
      },
    });
    transactions.push(
      ...withdrawals.map((w) => ({
        id: w.id,
        type: "withdrawal",
        amount: fmtNum(w.netAmount),
        label: `Withdrawal to ${w.bankAccount?.bankName ?? "Bank"}`,
        status: w.status,
        createdAt: w.createdAt,
        positive: false,
      })),
    );
  }

  // Sort all by date desc
  const sorted = transactions.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const total = sorted.length;
  const paginated = sorted.slice(skip, skip + limit);

  return {
    transactions: paginated,
    total,
    pages: Math.ceil(total / limit),
    page,
  };
}

// ── Bank accounts ─────────────────────────────────────────────────────────────

export async function getBankAccountsAction() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creator = await getCreatorOrThrow(session.user.id);

  return prisma.bankAccount.findMany({
    where: { creatorId: creator.id },
    orderBy: { isDefault: "desc" },
  });
}

const BankAccountSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  accountName: z.string().min(1, "Account name is required"),
  accountNumber: z.string().length(10, "Account number must be 10 digits"),
  bankCode: z.string().min(1, "Bank code is required"),
});

export async function addBankAccountAction(
  data: z.infer<typeof BankAccountSchema>,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = BankAccountSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const creator = await getCreatorOrThrow(session.user.id);

  const count = await prisma.bankAccount.count({
    where: { creatorId: creator.id },
  });

  const account = await prisma.bankAccount.create({
    data: {
      creatorId: creator.id,
      bankName: parsed.data.bankName,
      accountName: parsed.data.accountName,
      accountNumber: parsed.data.accountNumber,
      bankCode: parsed.data.bankCode,
      isDefault: count === 0, // first account = default
    },
  });

  return { success: true, accountId: account.id };
}

export async function setDefaultBankAccountAction(accountId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creator = await getCreatorOrThrow(session.user.id);

  await prisma.$transaction([
    prisma.bankAccount.updateMany({
      where: { creatorId: creator.id },
      data: { isDefault: false },
    }),
    prisma.bankAccount.update({
      where: { id: accountId, creatorId: creator.id },
      data: { isDefault: true },
    }),
  ]);

  return { success: true };
}

export async function deleteBankAccountAction(accountId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const creator = await getCreatorOrThrow(session.user.id);

  const account = await prisma.bankAccount.findFirst({
    where: { id: accountId, creatorId: creator.id },
  });
  if (!account) return { error: "Account not found." };

  if (account.isDefault) {
    return {
      error: "Cannot delete default account. Set another as default first.",
    };
  }

  await prisma.bankAccount.delete({ where: { id: accountId } });
  return { success: true };
}

// ── Withdraw ──────────────────────────────────────────────────────────────────

const WithdrawSchema = z.object({
  amount: z.number().min(1000, "Minimum withdrawal is ₦1,000"),
  bankAccountId: z.string().min(1, "Select a bank account"),
});

const PLATFORM_FEE_PERCENT = 10; // 10%

// actions/creator/wallet.ts — update withdrawAction

export async function withdrawAction(
    data: z.infer<typeof WithdrawSchema>
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const parsed = WithdrawSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0].message }

    const creator = await prisma.creator.findUnique({
        where:  { userId: session.user.id },
        include: { wallet: true },
    })
    if (!creator) redirect("/onboarding")

    // ── Unverified creators cannot withdraw ───────────────────────────────────
    if (!creator.isVerified || creator.verificationStatus !== "APPROVED") {
        return {
            error:            "UNVERIFIED",
            verificationStatus: creator.verificationStatus,
        }
    }

    // ── Initial Check balance (Fast-fail) ─────────────────────────────────────
    if (!creator.wallet) return { error: "Wallet not found." }
    if (fmtNum(creator.wallet.balance) < parsed.data.amount) {
        return { error: "Insufficient balance." }
    }

    // ── Verify bank account ───────────────────────────────────────────────────
    const bankAccount = await prisma.bankAccount.findFirst({
        where: { id: parsed.data.bankAccountId, creatorId: creator.id },
    })
    if (!bankAccount) return { error: "Bank account not found." }

    const grossAmount = parsed.data.amount
    const platformFee = Math.round(grossAmount * PLATFORM_FEE_PERCENT / 100)
    const netAmount   = grossAmount - platformFee

    // ── Get all admins ────────────────────────────────────────────────────────
    const admins = await prisma.user.findMany({
        where:  { role: "ADMIN" },
        select: { id: true },
    })

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Deduct from wallet securely (prevents race conditions)
            const debited = await tx.creatorWallet.updateMany({
                where: { creatorId: creator.id, balance: { gte: grossAmount } },
                data:  { balance: { decrement: grossAmount } },
            })
            
            if (debited.count === 0) {
                throw new Error("INSUFFICIENT_BALANCE")
            }

            // 2. Create withdrawal record
            await tx.withdrawal.create({
                data: {
                    creatorId:     creator.id,
                    bankAccountId: parsed.data.bankAccountId,
                    grossAmount,
                    platformFee,
                    netAmount,
                    status: "PENDING",
                },
            })

            // 3. Wallet transaction record
            await tx.creatorWalletTransaction.create({
                data: {
                    walletId:    creator.wallet!.id, // Non-null asserted because of the check above
                    amount:      grossAmount,
                    type:        "WITHDRAWAL",
                    description: `Withdrawal to ${bankAccount.bankName} · ${bankAccount.accountNumber}`,
                },
            })

            // 4. Notify the creator
            await tx.notification.create({
                data: {
                    userId: session.user.id,
                    type:   "PAYOUT_PROCESSED",
                    title:  "Withdrawal request submitted",
                    body:   `₦${netAmount.toLocaleString()} withdrawal is pending admin approval.`,
                    href:   "/creator/monetization/wallet",
                },
            })

            // 5. Notify all admins (using Promise.all for concurrency)
            if (admins.length > 0) {
                await Promise.all(
                    admins.map((admin) =>
                        tx.notification.create({
                            data: {
                                userId: admin.id,
                                type:   "SYSTEM",
                                title:  "New withdrawal request",
                                body:   `${creator.displayName} requested a withdrawal of ₦${netAmount.toLocaleString()}.`,
                                href:   "/admin/payouts",
                            },
                        })
                    )
                )
            }
        })

        return { success: true, netAmount }

    } catch (error) {
        if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
            return { error: "Insufficient balance. Your request could not be processed." }
        }
        
        console.error("Withdrawal transaction error:", error)
        return { error: "An error occurred while processing your withdrawal. Please try again." }
    }
}

export async function getPayoutHistoryAction(params?: {
    status?: "PENDING" | "APPROVED" | "PAID" | "REJECTED"
    page?:   number
    limit?:  number
}) {
    const session = await auth()
    if (!session?.user?.id) redirect("/login")

    const creator = await getCreatorOrThrow(session.user.id)

    const page  = params?.page  ?? 1
    const limit = params?.limit ?? 20
    const skip  = (page - 1) * limit

    const where = {
        creatorId: creator.id,
        ...(params?.status ? { status: params.status } : {}),
    }

    const [payouts, total, totalPaidAgg, totalPendingAgg, totalFeesAgg] = await Promise.all([
        prisma.withdrawal.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
                bankAccount: {
                    select: { bankName: true, accountNumber: true, accountName: true },
                },
            },
        }),
        prisma.withdrawal.count({ where }),
        prisma.withdrawal.aggregate({
            where: { creatorId: creator.id, status: "PAID" },
            _sum:  { netAmount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { creatorId: creator.id, status: { in: ["PENDING", "APPROVED"] } },
            _sum:  { netAmount: true },
        }),
        prisma.withdrawal.aggregate({
            where: { creatorId: creator.id },
            _sum:  { platformFee: true },
        }),
    ])

    return {
        payouts,
        total,
        pages: Math.ceil(total / limit),
        page,
        stats: {
            totalPaid:    Number(totalPaidAgg._sum.netAmount    ?? 0),
            totalPending: Number(totalPendingAgg._sum.netAmount ?? 0),
            totalFees:    Number(totalFeesAgg._sum.platformFee  ?? 0),
        },
    }
}