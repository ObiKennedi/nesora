// components/creator/analytics/AudienceTab.tsx
"use client"

import {
    BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from "recharts"
import { Users, MapPin } from "lucide-react"

type Props = {
    data: {
        totalAudience: number
        ageGroups:     { range: string; count: number }[]
        genderCounts:  { gender: string; count: number }[]
        topLocations:  { location: string; count: number }[]
        activeHours:   { hour: number; count: number }[]
    }
}

const genderColors: Record<string, string> = {
    MALE:              "#2563eb",
    FEMALE:             "#c2622a",
    OTHER:              "#7c3aed",
    PREFER_NOT_TO_SAY:  "#9ca3af",
    Unknown:            "#d1d5db",
}

const genderLabels: Record<string, string> = {
    MALE:              "Male",
    FEMALE:             "Female",
    OTHER:              "Other",
    PREFER_NOT_TO_SAY:  "Prefer not to say",
    Unknown:            "Unknown",
}

export const AudienceTab = ({ data }: Props) => {

    const genderData = data.genderCounts
        .filter((g) => g.count > 0)
        .map((g) => ({ name: genderLabels[g.gender], value: g.count, color: genderColors[g.gender] }))

    const formatHour = (h: number) => {
        if (h === 0)  return "12am"
        if (h === 12) return "12pm"
        return h < 12 ? `${h}am` : `${h - 12}pm`
    }

    return (
        <div className="analytics-grid">

            {/* ── Age groups ── */}
            <div className="analytics-card">
                <h3 className="analytics-card__title">Age Groups</h3>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.ageGroups} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD9" vertical={false} />
                        <XAxis dataKey="range" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E0DDD9" }}
                        />
                        <Bar dataKey="count" fill="#c2622a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* ── Gender breakdown ── */}
            <div className="analytics-card">
                <h3 className="analytics-card__title">Gender Breakdown</h3>
                {genderData.length === 0 ? (
                    <div className="analytics-card__empty">No data yet</div>
                ) : (
                    <div className="gender-chart">
                        <ResponsiveContainer width="100%" height={180}>
                            <PieChart>
                                <Pie
                                    data={genderData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={2}
                                >
                                    {genderData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="gender-legend">
                            {genderData.map((g) => (
                                <div key={g.name} className="gender-legend__item">
                                    <span className="gender-legend__dot" style={{ backgroundColor: g.color }} />
                                    {g.name} · {g.value}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Top locations ── */}
            <div className="analytics-card">
                <h3 className="analytics-card__title">
                    <MapPin size={14} /> Top Locations
                </h3>
                {data.topLocations.length === 0 ? (
                    <div className="analytics-card__empty">No location data yet</div>
                ) : (
                    <div className="location-list">
                        {data.topLocations.map((loc, i) => {
                            const max = data.topLocations[0].count
                            const pct = Math.round((loc.count / max) * 100)
                            return (
                                <div key={loc.location} className="location-item">
                                    <span className="location-item__rank">{i + 1}</span>
                                    <div className="location-item__bar-wrap">
                                        <span className="location-item__name">{loc.location}</span>
                                        <div className="location-item__bar">
                                            <div className="location-item__fill" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                    <span className="location-item__count">{loc.count}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Active hours ── */}
            <div className="analytics-card analytics-card--wide">
                <h3 className="analytics-card__title">Active Hours</h3>
                <p className="analytics-card__subtitle">When your audience is most active (based on follow activity)</p>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.activeHours} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD9" vertical={false} />
                        <XAxis
                            dataKey="hour"
                            tickFormatter={formatHour}
                            tick={{ fontSize: 10, fill: "#9A9A9A" }}
                            axisLine={false}
                            tickLine={false}
                            interval={2}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                            labelFormatter={(h) => formatHour(Number(h))}
                            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E0DDD9" }}
                        />
                        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

        </div>
    )
}