// components/creator/profile/SocialLinksForm.tsx
"use client"

import { useState, useTransition } from "react"
import { Loader2, CheckCircle }    from "lucide-react"
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa"
import { FaXTwitter }              from "react-icons/fa6"
import { updateSocialLinksAction } from "@/actions/creator/profile"

type Props = {
    creator: {
        instagramUrl: string | null
        twitterUrl:   string | null
        tiktokUrl:    string | null
        youtubeUrl:   string | null
    }
    onSuccess: () => void
}

const SOCIALS = [
    { key: "instagramUrl", label: "Instagram", icon: <FaInstagram size={18} />, placeholder: "https://instagram.com/yourhandle", color: "#e1306c" },
    { key: "twitterUrl",   label: "X (Twitter)", icon: <FaXTwitter size={18} />, placeholder: "https://x.com/yourhandle",       color: "#000000" },
    { key: "tiktokUrl",    label: "TikTok",    icon: <FaTiktok   size={18} />, placeholder: "https://tiktok.com/@yourhandle", color: "#010101" },
    { key: "youtubeUrl",   label: "YouTube",   icon: <FaYoutube  size={18} />, placeholder: "https://youtube.com/@yourchannel", color: "#ff0000" },
] as const

export const SocialLinksForm = ({ creator, onSuccess }: Props) => {

    const [values,    setValues]    = useState({
        instagramUrl: creator.instagramUrl ?? "",
        twitterUrl:   creator.twitterUrl   ?? "",
        tiktokUrl:    creator.tiktokUrl    ?? "",
        youtubeUrl:   creator.youtubeUrl   ?? "",
    })
    const [saved,     setSaved]     = useState(false)
    const [error,     setError]     = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const res = await updateSocialLinksAction(values)
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
                <h3>Social Links</h3>
            </div>

            <div className="profile-section__body">
                {SOCIALS.map((s) => (
                    <div key={s.key} className="profile-social-field">
                        <span
                            className="profile-social-field__icon"
                            style={{ color: s.color }}
                        >
                            {s.icon}
                        </span>
                        <div className="profile-form-field" style={{ flex: 1 }}>
                            <label>{s.label}</label>
                            <input
                                type="url"
                                placeholder={s.placeholder}
                                value={values[s.key]}
                                onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
                                disabled={isPending}
                            />
                        </div>
                    </div>
                ))}

                {error && <p className="profile-section__error">{error}</p>}

                <button className="profile-save-btn" onClick={handleSave} disabled={isPending}>
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle size={14} /> Saved!</>
                        : "Save Social Links"
                    }
                </button>
            </div>
        </div>
    )
}