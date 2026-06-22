// components/creator/wallet/WalletOverview.tsx
import { TrendingUp, TrendingDown, Wallet, Clock, ArrowDownToLine } from "lucide-react"

type Props = {
    overview: {
        balance:          number
        pendingPayouts:   number
        thisMonthTotal:   number
        allTimeEarnings:  number
        allTimeWithdrawn: number
        trend:            number
    }
    onWithdraw: () => void
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style:                 "currency",
        currency:              "NGN",
        maximumFractionDigits: 0,
    }).format(n)

export const WalletOverview = ({ overview, onWithdraw }: Props) => {

    const cards = [
        {
            label:  "Available Balance",
            value:  fmtMoney(overview.balance),
            icon:   <Wallet size={20} />,
            color:  "primary",
            action: (
                <button className="wallet-overview__withdraw-btn" onClick={onWithdraw}>
                    <ArrowDownToLine size={14} />
                    Withdraw
                </button>
            ),
        },
        {
            label: "This Month",
            value: fmtMoney(overview.thisMonthTotal),
            icon:  overview.trend >= 0
                ? <TrendingUp   size={20} />
                : <TrendingDown size={20} />,
            color: overview.trend >= 0 ? "green" : "red",
            sub:   `${overview.trend >= 0 ? "+" : ""}${overview.trend}% vs last month`,
        },
        {
            label: "Pending Payouts",
            value: fmtMoney(overview.pendingPayouts),
            icon:  <Clock size={20} />,
            color: "amber",
            sub:   "Processing in 2–3 business days",
        },
        {
            label: "All Time Earnings",
            value: fmtMoney(overview.allTimeEarnings),
            icon:  <TrendingUp size={20} />,
            color: "blue",
            sub:   `${fmtMoney(overview.allTimeWithdrawn)} withdrawn`,
        },
    ]

    return (
        <div className="wallet-overview">
            {cards.map((card) => (
                <div key={card.label} className={`wallet-card wallet-card--${card.color}`}>
                    <div className="wallet-card__top">
                        <span className="wallet-card__icon">{card.icon}</span>
                        {card.action}
                    </div>
                    <div className="wallet-card__body">
                        <p className="wallet-card__value">{card.value}</p>
                        <p className="wallet-card__label">{card.label}</p>
                        {card.sub && <p className="wallet-card__sub">{card.sub}</p>}
                    </div>
                </div>
            ))}
        </div>
    )
}