// components/creator/analytics/RevenueTab.tsx
"use client"

import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from "recharts"

type Props = {
    data: {
        trends: {
            month:          string
            subscriptions:  number
            gifts:          number
            tips:           number
            total:          number
            newSubscribers: number
            netGrowth:      number
        }[]
        revenueBySource: {
            subscriptions: number
            gifts:         number
            tips:          number
            total:         number
        }
    }
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency", currency: "NGN", maximumFractionDigits: 0, notation: "compact",
    }).format(n)

const fmtFull = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency", currency: "NGN", maximumFractionDigits: 0,
    }).format(n)

export const RevenueTab = ({ data }: Props) => {

    const sourcePct = (val: number) =>
        data.revenueBySource.total === 0 ? 0 : Math.round((val / data.revenueBySource.total) * 100)

    return (
        <div className="revenue-analytics">

            {/* ── Earnings trend ── */}
            <div className="analytics-card">
                <h3 className="analytics-card__title">Earnings Trend — Last 6 Months</h3>
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data.trends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#c2622a" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="#c2622a" stopOpacity={0}    />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={50} />
                        <Tooltip formatter={(v) => typeof v === "number" ? fmtFull(v) : ""} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E0DDD9" }} />
                        <Area type="monotone" dataKey="total" name="Total Earnings" stroke="#c2622a" fill="url(#colorTotal)" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="analytics-grid">

                {/* ── Subscriber growth ── */}
                <div className="analytics-card">
                    <h3 className="analytics-card__title">Subscriber Growth</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data.trends} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD9" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E0DDD9" }} />
                            <Bar dataKey="newSubscribers" name="New Subscribers" fill="#16a34a" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* ── Revenue by source ── */}
                <div className="analytics-card">
                    <h3 className="analytics-card__title">Revenue by Source — All Time</h3>
                    <div className="revenue-source-breakdown">
                        {[
                            { label: "Subscriptions", value: data.revenueBySource.subscriptions, color: "#c2622a" },
                            { label: "Gifts",          value: data.revenueBySource.gifts,          color: "#d97706" },
                            { label: "Tips",           value: data.revenueBySource.tips,            color: "#2563eb" },
                        ].map((src) => (
                            <div key={src.label} className="rsb-item">
                                <div className="rsb-item__top">
                                    <span className="rsb-item__dot" style={{ backgroundColor: src.color }} />
                                    <span className="rsb-item__label">{src.label}</span>
                                    <span className="rsb-item__pct">{sourcePct(src.value)}%</span>
                                </div>
                                <div className="rsb-item__bar">
                                    <div
                                        className="rsb-item__fill"
                                        style={{ width: `${sourcePct(src.value)}%`, backgroundColor: src.color }}
                                    />
                                </div>
                                <span className="rsb-item__value">{fmtFull(src.value)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="revenue-source-breakdown__total">
                        <span>Total Revenue</span>
                        <strong>{fmtFull(data.revenueBySource.total)}</strong>
                    </div>
                </div>

            </div>
        </div>
    )
}