// components/creator/wallet/TransactionHistory.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Loader2, ArrowUpRight, ArrowDownLeft }             from "lucide-react"
import { getTransactionHistoryAction }                      from "@/actions/creator/wallet"
import { format }                                           from "date-fns"

type Transaction = Awaited<ReturnType<typeof getTransactionHistoryAction>>["transactions"][0]
type FilterType  = "all" | "subscriptions" | "gifts" | "tips" | "withdrawals"

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style:                 "currency",
        currency:              "NGN",
        maximumFractionDigits: 0,
    }).format(n)

const typeColor: Record<string, string> = {
    subscription: "green",
    gift:         "amber",
    tip:          "red",
    withdrawal:   "blue",
}

const FILTERS: { value: FilterType; label: string }[] = [
    { value: "all",           label: "All"          },
    { value: "subscriptions", label: "Subscriptions"},
    { value: "gifts",         label: "Gifts"        },
    { value: "tips",          label: "Tips"         },
    { value: "withdrawals",   label: "Withdrawals"  },
]

export const TransactionHistory = () => {

    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [total,        setTotal]        = useState(0)
    const [pages,        setPages]        = useState(1)
    const [page,         setPage]         = useState(1)
    const [filter,       setFilter]       = useState<FilterType>("all")
    const [isPending,    startTransition] = useTransition()

    const fetchTransactions = useCallback(() => {
        startTransition(async () => {
            const res = await getTransactionHistoryAction({
                type: filter,
                page,
                limit: 20,
            })
            setTransactions(res.transactions)
            setTotal(res.total)
            setPages(res.pages)
        })
    }, [filter, page])

    useEffect(() => { fetchTransactions() }, [fetchTransactions])

    return (
        <div className="transaction-history">
            <div className="transaction-history__header">
                <h3 className="wallet-section-title">Transaction History</h3>
                <div className="tx-filter-group">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            className={`tx-filter-btn ${filter === f.value ? "tx-filter-btn--active" : ""}`}
                            onClick={() => { setFilter(f.value); setPage(1) }}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {isPending ? (
                <div className="transaction-history__loading">
                    <Loader2 size={20} className="spin" />
                </div>
            ) : transactions.length === 0 ? (
                <div className="transaction-history__empty">
                    <p>No transactions found</p>
                </div>
            ) : (
                <>
                    <div className="transaction-history__list">
                        {transactions.map((tx) => (
                            <div key={`${tx.type}-${tx.id}`} className="tx-item">
                                <div className={`tx-item__icon tx-item__icon--${typeColor[tx.type]}`}>
                                    {tx.positive
                                        ? <ArrowDownLeft  size={16} />
                                        : <ArrowUpRight   size={16} />
                                    }
                                </div>
                                <div className="tx-item__info">
                                    <p className="tx-item__label">{tx.label}</p>
                                    <span className="tx-item__date">
                                        {format(new Date(tx.createdAt), "d MMM yyyy · h:mm a")}
                                    </span>
                                </div>
                                <div className="tx-item__right">
                                    <p className={`tx-item__amount ${tx.positive ? "tx-item__amount--positive" : "tx-item__amount--negative"}`}>
                                        {tx.positive ? "+" : "-"}{fmtMoney(tx.amount)}
                                    </p>
                                    {"status" in tx && tx.status && (
                                        <span className={`tx-status tx-status--${(tx.status as string).toLowerCase()}`}>
                                            {tx.status as string}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {pages > 1 && (
                        <div className="transaction-history__pagination">
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page === 1 || isPending}
                            >
                                Previous
                            </button>
                            <span className="page-indicator">
                                Page {page} of {pages}
                            </span>
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page === pages || isPending}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}