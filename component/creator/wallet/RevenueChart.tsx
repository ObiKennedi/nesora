// components/creator/wallet/RevenueChart.tsx
"use client"

import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"

type Props = {
    data: {
        month:         string
        subscriptions: number
        gifts:         number
        tips:          number
        total:         number
    }[]
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style:                 "currency",
        currency:              "NGN",
        maximumFractionDigits: 0,
        notation:              "compact",
    }).format(n)

export const RevenueChart = ({ data }: Props) => {
    return (
        <div className="revenue-chart">
            <h3 className="wallet-section-title">Revenue — Last 6 Months</h3>
            <div className="revenue-chart__wrap">
                <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#c2622a" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#c2622a" stopOpacity={0}   />
                            </linearGradient>
                            <linearGradient id="colorGifts" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#d97706" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#d97706" stopOpacity={0}   />
                            </linearGradient>
                            <linearGradient id="colorTips" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}   />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD9" />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 11, fill: "#9A9A9A", fontFamily: "Inter" }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={fmtMoney}
                            tick={{ fontSize: 11, fill: "#9A9A9A", fontFamily: "Inter" }}
                            axisLine={false}
                            tickLine={false}
                            width={60}
                        />
                        <Tooltip
                            cursor={{
                                stroke:      "#c2622a",
                                strokeWidth: 1,
                                strokeDasharray: "3 3",
                            }}
                            formatter={(value) => typeof value === "number" ? fmtMoney(value) as any : String(value ?? "")}
                            contentStyle={{
                                fontFamily:   "Inter, sans-serif",
                                fontSize:     12,
                                borderRadius: 8,
                                border:       "1px solid #E0DDD9",
                            }}
                        />
                        <Legend
                            wrapperStyle={{
                                fontSize:   11,
                                fontFamily: "Inter, sans-serif",
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="subscriptions"
                            name="Subscriptions"
                            stroke="#c2622a"
                            fill="url(#colorSubs)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="gifts"
                            name="Gifts"
                            stroke="#d97706"
                            fill="url(#colorGifts)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="tips"
                            name="Tips"
                            stroke="#2563eb"
                            fill="url(#colorTips)"
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}