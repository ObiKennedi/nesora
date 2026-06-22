// components/creator/profile/BrandingForm.tsx
"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle, Sun, Moon } from "lucide-react"
import { updateBrandingAction }    from "@/actions/creator/profile"

type Props = {
    creator: {
        accentColor:  string | null
        profileTheme: string
    }
    onSuccess: () => void
}

const PRESET_COLORS = [
    "#c2622a", // NESORA primary
    "#2563eb", // blue
    "#16a34a", // green
    "#d97706", // amber
    "#7c3aed", // purple
    "#dc2626", // red
    "#0891b2", // cyan
    "#db2777", // pink
    "#1a1a1a", // dark
]

export const BrandingForm = ({ creator, onSuccess }: Props) => {

    const [color,     setColor]     = useState(creator.accentColor ?? "#c2622a")
    const [theme,     setTheme]     = useState(creator.profileTheme ?? "light")
    const [saved,     setSaved]     = useState(false)
    const [error,     setError]     = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await updateBrandingAction({
                accentColor:  color,
                profileTheme: theme as "light" | "dark",
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
        <div className="profile-section">
            <div className="profile-section__header">
                <h3>Branding</h3>
                <p>Customise how your profile looks to fans.</p>
            </div>

            <div className="profile-section__body">

                {/* Accent color */}
                <div className="profile-form-field">
                    <label>Accent Color</label>
                    <div className="branding-colors">
                        {PRESET_COLORS.map((c) => (
                            <button
                                key={c}
                                type="button"
                                className={`branding-color-swatch ${color === c ? "branding-color-swatch--active" : ""}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setColor(c)}
                                disabled={isPending}
                            />
                        ))}
                        {/* Custom color picker */}
                        <label
                            className="branding-color-custom"
                            title="Custom color"
                        >
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                disabled={isPending}
                            />
                            <span style={{ backgroundColor: color }} />
                        </label>
                    </div>
                    <p className="branding-color-preview">
                        Selected: <strong style={{ color }}>{color}</strong>
                    </p>
                </div>

                {/* Theme */}
                <div className="profile-form-field">
                    <label>Profile Theme</label>
                    <div className="branding-themes">
                        <button
                            type="button"
                            className={`branding-theme-btn ${theme === "light" ? "branding-theme-btn--active" : ""}`}
                            onClick={() => setTheme("light")}
                            disabled={isPending}
                        >
                            <Sun size={16} />
                            Light
                        </button>
                        <button
                            type="button"
                            className={`branding-theme-btn ${theme === "dark" ? "branding-theme-btn--active" : ""}`}
                            onClick={() => setTheme("dark")}
                            disabled={isPending}
                        >
                            <Moon size={16} />
                            Dark
                        </button>
                    </div>
                </div>

                {error && <p className="profile-section__error">{error}</p>}

                <button className="profile-save-btn" onClick={handleSave} disabled={isPending}>
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle size={14} /> Saved!</>
                        : "Save Branding"
                    }
                </button>

            </div>
        </div>
    )
}