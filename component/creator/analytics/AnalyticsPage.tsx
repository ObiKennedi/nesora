// components/creator/analytics/AnalyticsPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Loader2, Users, FileText, DollarSign }            from "lucide-react"
import {
    getAudienceAnalyticsAction,
    getContentAnalyticsAction,
    getRevenueAnalyticsAction,
} from "@/actions/creator/analytics"
import { AudienceTab } from "./AudienceTab"
import { ContentTab }  from "./ContentTab"
import { RevenueTab }  from "./RevenueTab"
import "@/styles/creator/analytics/AnalyticsPage.scss"

type Tab = "audience" | "content" | "revenue"

export const AnalyticsPage = () => {

    const [tab,       setTab]       = useState<Tab>("audience")
    const [audience,  setAudience]  = useState<Awaited<ReturnType<typeof getAudienceAnalyticsAction>> | null>(null)
    const [content,   setContent]   = useState<Awaited<ReturnType<typeof getContentAnalyticsAction>> | null>(null)
    const [revenue,   setRevenue]   = useState<Awaited<ReturnType<typeof getRevenueAnalyticsAction>> | null>(null)
    const [isPending, startTransition] = useTransition()

    const fetchAll = useCallback(() => {
        startTransition(async () => {
            const [a, c, r] = await Promise.all([
                getAudienceAnalyticsAction(),
                getContentAnalyticsAction(),
                getRevenueAnalyticsAction(),
            ])
            setAudience(a)
            setContent(c)
            setRevenue(r)
        })
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const tabs = [
        { id: "audience" as Tab, label: "Audience", icon: <Users      size={16} /> },
        { id: "content"  as Tab, label: "Content",   icon: <FileText  size={16} /> },
        { id: "revenue"  as Tab, label: "Revenue",   icon: <DollarSign size={16} /> },
    ]

    return (
        <div className="analytics-page">

            {/* ── Header ── */}
            <div className="analytics-page__header">
                <h2>Analytics</h2>
                <p>Your business intelligence center</p>
            </div>

            {/* ── Tabs ── */}
            <div className="analytics-tabs">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        className={`analytics-tab ${tab === t.id ? "analytics-tab--active" : ""}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            {isPending && !audience ? (
                <div className="analytics-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : (
                <>
                    {tab === "audience" && audience && <AudienceTab data={audience} />}
                    {tab === "content"  && content  && <ContentTab  data={content}  />}
                    {tab === "revenue"  && revenue  && <RevenueTab  data={revenue}  />}
                </>
            )}

        </div>
    )
}