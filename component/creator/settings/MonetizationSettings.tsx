// components/creator/settings/MonetizationSettings.tsx
"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle }    from "lucide-react"
import { updateMonetizationSettingsAction } from "@/actions/creator/settings"

type Props = {
    data: {
        creator: {
            subscriptionEnabled:  boolean
            subscriptionPrice:    any
            subscriberDMsEnabled: boolean
            subscriberDMPrice:    any
        } | null
    }
    onSuccess: () => void
}

export const MonetizationSettings = ({ data, onSuccess }: Props) => {

    const [subsEnabled,  setSubsEnabled]  = useState(data.creator?.subscriptionEnabled  ?? false)
    const [subsPrice,    setSubsPrice]    = useState(Number(data.creator?.subscriptionPrice  ?? 0))
    const [dmsEnabled,   setDmsEnabled]   = useState(data.creator?.subscriberDMsEnabled ?? false)
    const [dmsPrice,     setDmsPrice]     = useState(Number(data.creator?.subscriberDMPrice  ?? 0))
    const [saved,        setSaved]        = useState(false)
    const [error,        setError]        = useState<string | null>(null)
    const [isPending,    startTransition] = useTransition()

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await updateMonetizationSettingsAction({
                subscriptionEnabled:  subsEnabled,
                subscriptionPrice:    subsEnabled ? subsPrice : undefined,
                subscriberDMsEnabled: dmsEnabled,
                subscriberDMPrice:    dmsEnabled ? dmsPrice : undefined,
            })
            if (res?.error) {
                setError(res.error)
            } else {
                setSaved(true)
                onSuccess()
                setTimeout(() => setSaved(false), 2000)
            }
        })
    }

    return (
        <div className="settings-panel">
            <div className="settings-panel__header">
                <h2>Monetization Settings</h2>
                <p>Control how you earn from your audience.</p>
            </div>

            <div className="settings-panel__body">

                {/* Subscriptions */}
                <div className="settings-monetize-block">
                    <div className="settings-toggle-row">
                        <div>
                            <p className="settings-toggle-row__label">Subscriptions</p>
                            <p className="settings-toggle-row__desc">
                                Allow fans to subscribe to your content for a monthly fee.
                            </p>
                        </div>
                        <button
                            type="button"
                            className={`settings-toggle ${subsEnabled ? "settings-toggle--on" : ""}`}
                            onClick={() => setSubsEnabled((v) => !v)}
                            disabled={isPending}
                            role="switch"
                            aria-checked={subsEnabled}
                        >
                            <span className="settings-toggle__thumb" />
                        </button>
                    </div>

                    {subsEnabled && (
                        <div className="settings-field settings-field--indented">
                            <label>Default Subscription Price (₦/month)</label>
                            <div className="settings-price-wrap">
                                <span>₦</span>
                                <input
                                    type="number"
                                    value={subsPrice || ""}
                                    onChange={(e) => setSubsPrice(Number(e.target.value))}
                                    min={100}
                                    placeholder="0"
                                    disabled={isPending}
                                />
                            </div>
                            <p className="settings-field__hint">
                                This is the default price. You can create multiple tiers from{" "}
                                <a href="/creator/monetization/subscriptions">Subscription Plans</a>.
                            </p>
                        </div>
                    )}
                </div>

                <div className="settings-divider" />

                {/* Subscriber DMs */}
                <div className="settings-monetize-block">
                    <div className="settings-toggle-row">
                        <div>
                            <p className="settings-toggle-row__label">Paid Subscriber DMs</p>
                            <p className="settings-toggle-row__desc">
                                Charge fans to send you direct messages.
                            </p>
                        </div>
                        <button
                            type="button"
                            className={`settings-toggle ${dmsEnabled ? "settings-toggle--on" : ""}`}
                            onClick={() => setDmsEnabled((v) => !v)}
                            disabled={isPending}
                            role="switch"
                            aria-checked={dmsEnabled}
                        >
                            <span className="settings-toggle__thumb" />
                        </button>
                    </div>

                    {dmsEnabled && (
                        <div className="settings-field settings-field--indented">
                            <label>Price per DM (₦)</label>
                            <div className="settings-price-wrap">
                                <span>₦</span>
                                <input
                                    type="number"
                                    value={dmsPrice || ""}
                                    onChange={(e) => setDmsPrice(Number(e.target.value))}
                                    min={0}
                                    placeholder="0"
                                    disabled={isPending}
                                />
                            </div>
                            <p className="settings-field__hint">
                                Set to 0 to allow free DMs from all followers.
                            </p>
                        </div>
                    )}
                </div>

                {error && <p className="settings-error">{error}</p>}

                <button className="settings-save-btn" onClick={handleSave} disabled={isPending}>
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle size={14} /> Saved!</>
                        : "Save Settings"
                    }
                </button>

            </div>
        </div>
    )
}