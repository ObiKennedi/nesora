// components/creator/profile/BasicInfoForm.tsx
"use client"

import { useState, useTransition }    from "react"
import { Loader2, CheckCircle, Plus, X } from "lucide-react"
import {
    updateBasicProfileAction,
    updateUsernameAction,
} from "@/actions/creator/profile"

type Props = {
    creator: {
        displayName: string
        bio:         string | null
        websiteUrl:  string | null
        links:       string[]
        handle:      string | null
    }
    user: {
        username: string | null
        email:    string | null
    } | null
    onSuccess: () => void
}

export const BasicInfoForm = ({ creator, user, onSuccess }: Props) => {

    const [displayName, setDisplayName] = useState(creator.displayName)
    const [bio,         setBio]         = useState(creator.bio ?? "")
    const [website,     setWebsite]     = useState(creator.websiteUrl ?? "")
    const [links,       setLinks]       = useState<string[]>(creator.links)
    const [newLink,     setNewLink]     = useState("")
    const [username,    setUsername]    = useState(user?.username ?? "")
    const [saved,       setSaved]       = useState(false)
    const [error,       setError]       = useState<string | null>(null)
    const [isPending,   startTransition] = useTransition()

    const handleSave = () => {
        setError(null)
        startTransition(async () => {
            const [profileRes, usernameRes] = await Promise.all([
                updateBasicProfileAction({ displayName, bio, websiteUrl: website, links }),
                username !== user?.username ? updateUsernameAction(username) : Promise.resolve({ success: true }),
            ])

            if (profileRes?.error)  { setError(profileRes.error);  return }
            if ((usernameRes as any)?.error) { setError((usernameRes as any).error); return }

            setSaved(true)
            onSuccess()
            setTimeout(() => setSaved(false), 2000)
        })
    }

    const addLink = () => {
        if (!newLink || links.length >= 5) return
        try {
            new URL(newLink)
            setLinks((prev) => [...prev, newLink])
            setNewLink("")
        } catch {
            setError("Enter a valid URL including https://")
        }
    }

    return (
        <div className="profile-section">
            <div className="profile-section__header">
                <h3>Basic Information</h3>
            </div>

            <div className="profile-section__body">

                <div className="profile-form-row">
                    <div className="profile-form-field">
                        <label>Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Your creator name"
                            maxLength={50}
                            disabled={isPending}
                        />
                    </div>
                    <div className="profile-form-field">
                        <label>Username</label>
                        <div className="profile-username-wrap">
                            <span>@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                                placeholder="yourhandle"
                                maxLength={30}
                                disabled={isPending}
                            />
                        </div>
                    </div>
                </div>

                <div className="profile-form-field">
                    <label>Bio <span>— {bio.length}/500</span></label>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell your audience about yourself..."
                        rows={4}
                        maxLength={500}
                        disabled={isPending}
                    />
                </div>

                <div className="profile-form-field">
                    <label>Website URL</label>
                    <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                        disabled={isPending}
                    />
                </div>

                {/* Custom links */}
                <div className="profile-form-field">
                    <label>Links <span>— {links.length}/5</span></label>
                    <div className="profile-links">
                        {links.map((link, i) => (
                            <div key={i} className="profile-link-item">
                                <span>{link}</span>
                                <button
                                    type="button"
                                    onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}
                                    disabled={isPending}
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                        {links.length < 5 && (
                            <div className="profile-link-add">
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    value={newLink}
                                    onChange={(e) => setNewLink(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                                    disabled={isPending}
                                />
                                <button type="button" onClick={addLink} disabled={isPending}>
                                    <Plus size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {error && <p className="profile-section__error">{error}</p>}

                <button className="profile-save-btn" onClick={handleSave} disabled={isPending || !displayName}>
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : saved
                        ? <><CheckCircle size={14} /> Saved!</>
                        : "Save Changes"
                    }
                </button>

            </div>
        </div>
    )
}