// components/creator/wallet/RevenueBreakdown.tsx
import { Star, Gift, Heart, MessageCircle, ShoppingBag } from "lucide-react"

type Props = {
    breakdown: {
        subscriptions: number
        gifts:         number
        tips:          number
        messages:      number
        content:       number
    }
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style:                 "currency",
        currency:              "NGN",
        maximumFractionDigits: 0,
    }).format(n)

const sources = (b: Props["breakdown"]) => [
    { label: "Subscriptions", value: b.subscriptions, icon: <Star          size={16} />, color: "primary" },
    { label: "Gifts",         value: b.gifts,         icon: <Gift          size={16} />, color: "amber"   },
    { label: "Tips",          value: b.tips,           icon: <Heart         size={16} />, color: "red"     },
    { label: "Paid Messages", value: b.messages,       icon: <MessageCircle size={16} />, color: "blue"    },
    { label: "Content Sales", value: b.content,        icon: <ShoppingBag   size={16} />, color: "purple"  },
]

export const RevenueBreakdown = ({ breakdown }: Props) => {
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0)

    return (
        <div className="revenue-breakdown">
            <h3 className="wallet-section-title">Revenue Sources — This Month</h3>
            <div className="revenue-breakdown__list">
                {sources(breakdown).map((src) => {
                    const pct = total === 0 ? 0 : Math.round((src.value / total) * 100)
                    return (
                        <div key={src.label} className="revenue-source">
                            <div className={`revenue-source__icon revenue-source__icon--${src.color}`}>
                                {src.icon}
                            </div>
                            <div className="revenue-source__info">
                                <div className="revenue-source__top">
                                    <span className="revenue-source__label">{src.label}</span>
                                    <span className="revenue-source__value">{fmtMoney(src.value)}</span>
                                </div>
                                <div className="revenue-source__bar">
                                    <div
                                        className={`revenue-source__fill revenue-source__fill--${src.color}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                <span className="revenue-source__pct">{pct}%</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}