// components/creator/settings/NotificationSettings.tsx
"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle }    from "lucide-react"
import {
    getNotificationPrefsAction,
    updateNotificationPrefsAction,
} from "@/actions/creator/settings"
import { useEffect }               from "react"

const IN_APP = [
    { key: "newFollower",     label: "New follower",      desc: "When someone follows you"             },
    { key: "newSubscriber",   label: "New subscriber",    desc: "When someone subscribes to your plan" },
    { key: "newMessage",      label: "New message",       desc: "When a fan sends you a DM"            },
    { key: "giftReceived",    label: "Gift received",     desc: "When a fan sends you a gift"          },
    { key: "payoutProcessed", label: "Payout processed",  desc: "When a withdrawal is approved or rejected" },
]

const EMAIL_NOTIFS = [
    { key: "emailNewFollower",   label: "New follower emails",      desc: "Daily digest of new followers"    },
    { key: "emailNewSubscriber", label: "New subscriber emails",    desc: "Instant email for new subscribers" },
    { key: "emailPayout",        label: "Payout emails",            desc: "When your payout is processed"    },
]

export const NotificationSettings = () => {

    const [prefs,     setPrefs]     = useState<Record<string, boolean>>({})
    const [loaded,    setLoaded]    = useState(false)
    const [saved,     setSaved]     = useState(false)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        startTransition(async () => {
            const res = await getNotificationPrefsAction()
            setPrefs(res)
            setLoaded(true)
        })
    }, [])

    const toggle = (key: string) => {
        setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
    }

    const handleSave = () => {
        startTransition(async () => {
            await updateNotificationPrefsAction(prefs)
            setSaved(true)
            setTimeout(() => setSaved(false), 2000)
        })
    }

    if (!loaded) return (
        <div className="settings-panel__loading">
            <Loader2 size={20} className="spin" />
        </div>
    )

    return (
        <div className="settings-panel">
            <div className="settings-panel__header">
                <h2>Notification Preferences</h2>
                <p>Choose what you want to be notified about.</p>
            </div>

            <div className="settings-panel__body">

                {/* In-app */}
                <div className="settings-notif-group">
                    <h3 className="settings-notif-group__title">In-App Notifications</h3>
                    {IN_APP.map((n) => (
                        <div key={n.key} className="settings-toggle-row">
                            <div>
                                <p className="settings-toggle-row__label">{n.label}</p>
                                <p className="settings-toggle-row__desc">{n.desc}</p>
                            </div>
                            <button
                                type="button"
                                className={`settings-toggle ${prefs[n.key] ? "settings-toggle--on" : ""}`}
                                onClick={() => toggle(n.key)}
                                disabled={isPending}
                                aria-checked={prefs[n.key]}
                                role="switch"
                            >
                                <span className="settings-toggle__thumb" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Email */}
                <div className="settings-notif-group">
                    <h3 className="settings-notif-group__title">Email Notifications</h3>
                    {EMAIL_NOTIFS.map((n) => (
                        <div key={n.key} className="settings-toggle-row">
                            <div>
                                <p className="settings-toggle-row__label">{n.label}</p>
                                <p className="settings-toggle-row__desc">{n.desc}</p>
                            </div>
                            <button
                                type="button"
                                className={`settings-toggle ${prefs[n.key] ? "settings-toggle--on" : ""}`}
                                onClick={() => toggle(n.key)}
                                disabled={isPending}
                                aria-checked={prefs[n.key]}
                                role="switch"
                            >
                                <span className="settings-toggle__thumb" />
                            </button>
                        </div>
                    ))}
                </div>

                <button className="settings-save-btn" onClick={handleSave} disabled={isPending}>
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle size={14} /> Saved!</>
                        : "Save Preferences"
                    }
                </button>

            </div>
        </div>
    )
}