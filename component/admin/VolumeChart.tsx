// component/admin/VolumeChart.tsx
"use client"

import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
} from "recharts"

type Props = {
    data: {
        month:         string
        subscriptions: number
        gifts:         number
        tips:          number
        content:       number
        calls:         number
    }[]
}

const naira = (v: number) =>
    v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000   ? `₦${(v / 1_000).toFixed(0)}k`
    : `₦${v}`

const SERIES = [
    { key: "subscriptions", label: "Subscriptions", color: "#c2622a" },
    { key: "gifts",         label: "Gifts",         color: "#e0955f" },
    { key: "tips",          label: "Tips",          color: "#8c4a1f" },
    { key: "content",       label: "Content",       color: "#d9b8a3" },
    { key: "calls",         label: "Calls",         color: "#5c4636" },
] as const

export function VolumeChart({ data }: Props) {
    return (
        <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ece5de" vertical={false} />
                <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: "#6b6259" }}
                    axisLine={false}
                    tickLine={false}
                />
                <YAxis
                    tickFormatter={naira}
                    tick={{ fontSize: 12, fill: "#6b6259" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                />
                <Tooltip
                    formatter={(value, name) => [
                        typeof value === "number" ? `₦${value.toLocaleString()}` : String(value ?? ""),
                        name,
                    ]}
                    contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #ece5de",
                        fontSize: 13,
                    }}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                {SERIES.map((s) => (
                    <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.label}
                        stackId="volume"
                        fill={s.color}
                        radius={s.key === "calls" ? [4, 4, 0, 0] : 0}
                    />
                ))}
            </BarChart>
        </ResponsiveContainer>
    )
}