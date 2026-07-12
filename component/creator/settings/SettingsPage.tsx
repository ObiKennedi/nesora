// components/creator/settings/SettingsPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Loader2, User, Lock, Bell, BadgeDollarSign, Trash2, ShieldAlert, Phone, Sun, Moon} from "lucide-react"
import { getSettingsAction } from "@/actions/creator/settings"
import { AccountSettings }       from "./AccountSettings"
import { PasswordSettings }      from "./PasswordSettings"
import { NotificationSettings }  from "./NotificationSettings"
import { MonetizationSettings }  from "./MonetizationSettings"
import { CallSettings } from "@/component/creator/settings/CallSettings"
import { DangerZone }            from "./DangerZone"
import "@/styles/creator/settings/SettingsPage.scss"
import { useFanTheme } from "@/component/fan/FanThemeContext"

type SettingsData = Awaited<ReturnType<typeof getSettingsAction>>
type Tab = "account" | "password" | "notifications" | "monetization" | "calls" | "display" | "danger"

const TABS = [
    { id: "account"       as Tab, label: "Account",       icon: <User             size={16} /> },
    { id: "password"      as Tab, label: "Password",      icon: <Lock             size={16} /> },
    { id: "notifications" as Tab, label: "Notifications", icon: <Bell             size={16} /> },
    { id: "monetization"  as Tab, label: "Monetization",  icon: <BadgeDollarSign  size={16} /> },
    { id: "calls"         as Tab, label: "Calls",         icon: <Phone            size={16} /> },
    { id: "display"       as Tab, label: "Display Theme", icon: <Sun              size={16} /> },
    { id: "danger"        as Tab, label: "Danger Zone",   icon: <ShieldAlert      size={16} />, danger: true },
]

export const SettingsPage = () => {

    const [data,      setData]      = useState<SettingsData | null>(null)
    const [tab,       setTab]       = useState<Tab>("account")
    const [isPending, startTransition] = useTransition()

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const res = await getSettingsAction()
            setData(res)
        })
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    if (isPending && !data) {
        return (
            <div className="settings-page__loading">
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    if (!data) return null

    return (
        <div className="settings-page">

            {/* ── Sidebar tabs ── */}
            <div className="settings-sidebar">
                {TABS.map((t) => {
                    // Hide password tab for Google-only accounts
                    if (t.id === "password" && !data.hasPassword && data.isGoogleAccount) return null
                    return (
                        <button
                            key={t.id}
                            className={`settings-tab ${tab === t.id ? "settings-tab--active" : ""} ${t.danger ? "settings-tab--danger" : ""}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.icon}
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {/* ── Content ── */}
            <div className="settings-content">
                {tab === "account"       && <AccountSettings      data={data} onSuccess={fetchData} />}
                {tab === "password"      && <PasswordSettings     />}
                {tab === "notifications" && <NotificationSettings />}
                {tab === "monetization"  && <MonetizationSettings data={data} onSuccess={fetchData} />}
                {tab === "calls"         && <CallSettings/>}
                {tab === "display"       && <DisplaySettings      />}
                {tab === "danger"        && <DangerZone           data={data} />}
            </div>

        </div>
    )
}

// ─── Display Theme Tab ────────────────────────────────────────────────────────

const DisplaySettings = () => {
    const { theme, setTheme } = useFanTheme()

    return (
        <div className="settings-panel">
            <div className="settings-panel__header">
                <h2>Display Theme</h2>
                <p>Customize how NESORA looks for you. Choose between light and dark themes.</p>
            </div>
            <div className="settings-panel__body">
                <div className="branding-themes">
                    <button
                        type="button"
                        className={`branding-theme-btn ${theme === "light" ? "branding-theme-btn--active" : ""}`}
                        onClick={() => setTheme("light")}
                    >
                        <Sun size={16} />
                        Light Mode
                    </button>
                    <button
                        type="button"
                        className={`branding-theme-btn ${theme === "dark" ? "branding-theme-btn--active" : ""}`}
                        onClick={() => setTheme("dark")}
                    >
                        <Moon size={16} />
                        Dark Mode
                    </button>
                </div>
            </div>
        </div>
    )
}