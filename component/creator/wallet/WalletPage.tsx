// components/creator/wallet/WalletPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Loader2 }                from "lucide-react"
import { getWalletOverviewAction, getRevenueChartAction } from "@/actions/creator/wallet"
import { WalletOverview }         from "./WalletOverview"
import { RevenueBreakdown }       from "./RevenueBreakdown"
import { RevenueChart }           from "./RevenueChart"
import { TransactionHistory }     from "./TransactionHistory"
import { BankAccounts }           from "./BankAccounts"
import { WithdrawModal }          from "./WithdrawModal"
import "@/styles/creator/wallet/WalletPage.scss"

type Overview   = Awaited<ReturnType<typeof getWalletOverviewAction>>
type ChartData  = Awaited<ReturnType<typeof getRevenueChartAction>>

export const WalletPage = () => {

    const [overview,    setOverview]    = useState<Overview | null>(null)
    const [chartData,   setChartData]   = useState<ChartData>([])
    const [showWithdraw, setShowWithdraw] = useState(false)
    const [isPending,   startTransition] = useTransition()

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [ov, ch] = await Promise.all([
                getWalletOverviewAction(),
                getRevenueChartAction(),
            ])
            setOverview(ov)
            setChartData(ch)
        })
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    if (isPending && !overview) {
        return (
            <div className="wallet-page__loading">
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    return (
        <div className="wallet-page">

            {/* ── Overview cards ── */}
            {overview && (
                <WalletOverview
                    overview={overview}
                    onWithdraw={() => setShowWithdraw(true)}
                />
            )}

            <div className="wallet-page__body">
                <div className="wallet-page__main">

                    {/* Revenue chart */}
                    <RevenueChart data={chartData} />

                    {/* Revenue breakdown */}
                    {overview && (
                        <RevenueBreakdown breakdown={overview.breakdown} />
                    )}

                    {/* Transaction history */}
                    <TransactionHistory />

                </div>

                <aside className="wallet-page__aside">
                    {/* Bank accounts */}
                    <BankAccounts onWithdraw={() => setShowWithdraw(true)} />
                </aside>
            </div>

            {/* Withdraw modal */}
            {showWithdraw && overview && (
                <WithdrawModal
                    balance={overview.balance}
                    isVerified={overview.isVerified}
                    verificationStatus={overview.verificationStatus}
                    onClose={() => setShowWithdraw(false)}
                    onSuccess={() => {
                        setShowWithdraw(false)
                        fetchData()
                    }}
                />
            )}

        </div>
    )
}