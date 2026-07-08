"use client"

import { useState, useEffect, useTransition } from "react"
import {
    Phone, Video, Star, CircleDot,
    Loader2, Check,
} from "lucide-react"
import {
    getCallSettingsAction,
    updateCallSettingsAction,
} from "@/actions/calls/call-settings"
import "@/styles/creator/settings/CallSettings.scss"

type Settings = Awaited<ReturnType<typeof getCallSettingsAction>>

export const CallSettings = () => {

    const [settings, setSettings] = useState<Settings | null>(null)
    const [error,    setError]    = useState<string | null>(null)
    const [saved,    setSaved]    = useState(false)
    const [isLoading, startLoad]  = useTransition()
    const [isSaving,  startSave]  = useTransition()

    useEffect(() => {
        startLoad(async () => {
            const res = await getCallSettingsAction()
            setSettings(res)
        })
    }, [])

    const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings((s) => (s ? { ...s, [key]: value } : s))
        setSaved(false)
        setError(null)
    }

    const parseRate = (raw: string): number | null => {
        if (raw.trim() === "") return null
        const n = Number(raw)
        return Number.isFinite(n) && n >= 0 ? n : null
    }

    const handleSave = () => {
        if (!settings) return
        startSave(async () => {
            const res = await updateCallSettingsAction({
                voiceCallsEnabled:   settings.voiceCallsEnabled,
                videoCallsEnabled:   settings.videoCallsEnabled,
                voiceCallRate:       settings.voiceCallRate,
                videoCallRate:       settings.videoCallRate,
                availableForCalls:   settings.availableForCalls,
                topFanFreeCallCount: settings.topFanFreeCallCount,
            })
            if ("error" in res) {
                setError(res.error)
            } else {
                setSaved(true)
            }
        })
    }

    if (isLoading || !settings) {
        return (
            <div className="call-settings__loading">
                <Loader2 size={20} className="spin" />
            </div>
        )
    }

    return (
        <div className="call-settings">

            <div className="call-settings__header">
                <Phone size={18} />
                <div>
                    <h3>Calls</h3>
                    <p>Let fans you message with call you — free, or billed per minute from an hourly rate.</p>
                </div>
            </div>

            {/* ── Availability master switch ── */}
            <div className="call-settings__row">
                <div className="call-settings__row-info">
                    <CircleDot size={15} />
                    <div>
                        <p className="call-settings__row-title">Available for calls</p>
                        <p className="call-settings__row-desc">
                            Turn off to stop ringing entirely — fans see you as unavailable.
                        </p>
                    </div>
                </div>
                <button
                    className={`call-toggle ${settings.availableForCalls ? "call-toggle--on" : ""}`}
                    onClick={() => update("availableForCalls", !settings.availableForCalls)}
                    role="switch"
                    aria-checked={settings.availableForCalls}
                >
                    <span className="call-toggle__knob" />
                </button>
            </div>

            {/* ── Voice ── */}
            <div className="call-settings__row">
                <div className="call-settings__row-info">
                    <Phone size={15} />
                    <div>
                        <p className="call-settings__row-title">Voice calls</p>
                        <p className="call-settings__row-desc">Hourly rate in ₦ — leave empty for free.</p>
                    </div>
                </div>
                <div className="call-settings__row-controls">
                    {settings.voiceCallsEnabled && (
                        <div className="call-rate-input">
                            <span>₦</span>
                            <input
                                type="number"
                                min={0}
                                max={1_000_000}
                                placeholder="Free"
                                value={settings.voiceCallRate ?? ""}
                                onChange={(e) => update("voiceCallRate", parseRate(e.target.value))}
                            />
                            <span className="call-rate-input__suffix">/hr</span>
                        </div>
                    )}
                    <button
                        className={`call-toggle ${settings.voiceCallsEnabled ? "call-toggle--on" : ""}`}
                        onClick={() => update("voiceCallsEnabled", !settings.voiceCallsEnabled)}
                        role="switch"
                        aria-checked={settings.voiceCallsEnabled}
                    >
                        <span className="call-toggle__knob" />
                    </button>
                </div>
            </div>

            {/* ── Video ── */}
            <div className="call-settings__row">
                <div className="call-settings__row-info">
                    <Video size={15} />
                    <div>
                        <p className="call-settings__row-title">Video calls</p>
                        <p className="call-settings__row-desc">Hourly rate in ₦ — leave empty for free.</p>
                    </div>
                </div>
                <div className="call-settings__row-controls">
                    {settings.videoCallsEnabled && (
                        <div className="call-rate-input">
                            <span>₦</span>
                            <input
                                type="number"
                                min={0}
                                max={1_000_000}
                                placeholder="Free"
                                value={settings.videoCallRate ?? ""}
                                onChange={(e) => update("videoCallRate", parseRate(e.target.value))}
                            />
                            <span className="call-rate-input__suffix">/hr</span>
                        </div>
                    )}
                    <button
                        className={`call-toggle ${settings.videoCallsEnabled ? "call-toggle--on" : ""}`}
                        onClick={() => update("videoCallsEnabled", !settings.videoCallsEnabled)}
                        role="switch"
                        aria-checked={settings.videoCallsEnabled}
                    >
                        <span className="call-toggle__knob" />
                    </button>
                </div>
            </div>

            {/* ── Top fans ── */}
            <div className="call-settings__row">
                <div className="call-settings__row-info">
                    <Star size={15} />
                    <div>
                        <p className="call-settings__row-title">Free calls for top fans</p>
                        <p className="call-settings__row-desc">
                            Your top supporters call free even when calls are paid. Set to 0 to disable.
                        </p>
                    </div>
                </div>
                <div className="call-settings__topn">
                    <span>Top</span>
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={settings.topFanFreeCallCount}
                        onChange={(e) => {
                            const n = Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0)))
                            update("topFanFreeCallCount", n)
                        }}
                    />
                    <span>fans</span>
                </div>
            </div>

            {error && <p className="call-settings__error">{error}</p>}

            <div className="call-settings__footer">
                <button
                    className="call-settings__save"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <><Loader2 size={15} className="spin" /> Saving…</>
                    ) : saved ? (
                        <><Check size={15} /> Saved</>
                    ) : (
                        "Save call settings"
                    )}
                </button>
            </div>
        </div>
    )
}