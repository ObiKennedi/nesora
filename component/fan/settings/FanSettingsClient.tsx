// components/fan/settings/FanSettingsClient.tsx
"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import Image                                            from "next/image"
import { useRouter }                                    from "next/navigation"
import { signOut, useSession }                          from "next-auth/react"
import {
    User, AtSign, Lock, Heart, Bell, Trash2,
    Loader2, Camera, CheckCircle, XCircle, LogOut,
    AlertTriangle, ArrowRightLeft, Sun, Moon,
} from "lucide-react"
import {
    updateFanAccountAction,
    updateFanUsernameAction,
    checkFanUsernameAvailability,
    updateFanAvatarAction,
    changeFanPasswordAction,
    updateFanInterestsAction,
    getFanNotificationPrefsAction,
    updateFanNotificationPrefsAction,
    deleteFanAccountAction,
    switchToCreatorAction,
} from "@/actions/fan/settings"
import { CATEGORIES }   from "@/lib/categories"
import { Category }     from "@prisma/client"
import "@/styles/fan/Settings.scss"
import { useFanTheme } from "@/component/fan/FanThemeContext"

// ── Routes ────────────────────────────────────────────────────────────────────

const CREATOR_DASHBOARD = "/creator/dashboard"   // ← adjust to your actual route
const ONBOARDING        = "/onboarding"          // ← adjust to your actual route

// ── Types ─────────────────────────────────────────────────────────────────────

type User = {
    id:        string
    email:     string
    firstName: string
    lastName:  string
    username:  string
    image:     string | null
}

type Props = {
    user:            User
    interests:       Category[]
    isGoogleAccount: boolean
    hasPassword:     boolean
    isCreator:       boolean   // ← new: true when user has a Creator row with a handle
}

type Tab = "account" | "username" | "password" | "interests" | "notifications" | "display" | "danger"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "account",       label: "Account",        icon: <User    size={16} /> },
    { id: "username",      label: "Username",       icon: <AtSign  size={16} /> },
    { id: "password",      label: "Password",       icon: <Lock    size={16} /> },
    { id: "interests",     label: "Interests",      icon: <Heart   size={16} /> },
    { id: "notifications", label: "Notifications",  icon: <Bell    size={16} /> },
    { id: "display",       label: "Display Theme",  icon: <Sun     size={16} /> },
    { id: "danger",        label: "Delete Account", icon: <Trash2  size={16} /> },
]

// ── Cloudinary upload ─────────────────────────────────────────────────────────

async function uploadAvatar(file: File): Promise<string> {
    const form = new FormData()
    form.append("file",          file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        "nesora/avatars")

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message ?? "Upload failed")
    return data.secure_url
}

// ── FanSettingsClient ─────────────────────────────────────────────────────────

export const FanSettingsClient = ({ user, interests, isGoogleAccount, hasPassword, isCreator }: Props) => {
    const { update: updateSession } = useSession()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState<Tab>("account")
    const [toast,     setToast]     = useState<{ msg: string; type: "success" | "error" } | null>(null)
    const [isSwitching, startSwitch] = useTransition()

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3000)
    }

    const handleSwitchToCreator = () => {
        // Fully onboarded creator browsing fan mode — plain navigation, no server work
        if (isCreator) {
            router.push(CREATOR_DASHBOARD)
            return
        }

        // Not a creator yet (or bailed mid-onboarding) — flip intent, resume flow
        startSwitch(async () => {
            const res = await switchToCreatorAction()
            if (!res.success) {
                showToast(res.error, "error")
                return
            }
            // Refresh the JWT so middleware sees the new onboardingType before navigating
            await updateSession?.()
            router.push(res.destination === "dashboard" ? CREATOR_DASHBOARD : ONBOARDING)
        })
    }

    return (
        <div className="fan-settings">

            {/* Header */}
            <div className="fan-settings__header">
                <h1>Settings</h1>
            </div>

            <div className="fan-settings__layout">

                {/* Tab nav */}
                <nav className="fan-settings__tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            className={`fan-settings-tab ${activeTab === tab.id ? "fan-settings-tab--active" : ""} ${tab.id === "danger" ? "fan-settings-tab--danger" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </button>
                    ))}

                    <button
                        type="button"
                        className="fan-settings-tab fan-settings-tab--creator"
                        onClick={handleSwitchToCreator}
                        disabled={isSwitching}
                    >
                        {isSwitching ? <Loader2 size={16} className="spin" /> : <ArrowRightLeft size={16} />}
                        <span>{isCreator ? "Creator Dashboard" : "Become a Creator"}</span>
                    </button>

                    <button
                        type="button"
                        className="fan-settings-tab fan-settings-tab--signout"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                    >
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </nav>

                {/* Content */}
                <div className="fan-settings__content">
                    {activeTab === "account" && (
                        <AccountTab
                            user={user}
                            onToast={showToast}
                            onAvatarUpdate={async (url) => { await updateSession?.() }}
                        />
                    )}
                    {activeTab === "username" && (
                        <UsernameTab user={user} onToast={showToast} />
                    )}
                    {activeTab === "password" && (
                        <PasswordTab hasPassword={hasPassword} isGoogle={isGoogleAccount} onToast={showToast} />
                    )}
                    {activeTab === "interests" && (
                        <InterestsTab initial={interests} onToast={showToast} />
                    )}
                    {activeTab === "notifications" && (
                        <NotificationsTab onToast={showToast} />
                    )}
                    {activeTab === "display" && (
                        <DisplayTab />
                    )}
                    {activeTab === "danger" && (
                        <DangerTab hasPassword={hasPassword} onToast={showToast} />
                    )}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`fan-settings-toast fan-settings-toast--${toast.type}`}>
                    {toast.msg}
                </div>
            )}
        </div>
    )
}

// ─── Account Tab ──────────────────────────────────────────────────────────────

const AccountTab = ({
    user, onToast, onAvatarUpdate,
}: {
    user: User
    onToast: (msg: string, type?: "success" | "error") => void
    onAvatarUpdate: (url: string) => void
}) => {
    const [firstName, setFirstName] = useState(user.firstName)
    const [lastName,  setLastName]  = useState(user.lastName)
    const [email,     setEmail]     = useState(user.email)
    const [avatar,    setAvatar]    = useState(user.image)
    const [uploading, setUploading] = useState(false)
    const [isPending, startTransition] = useTransition()
    const fileRef = useRef<HTMLInputElement>(null)

    const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const url = await uploadAvatar(file)
            const res = await updateFanAvatarAction(url)
            if (res?.success) {
                setAvatar(url)
                onAvatarUpdate(url)
                onToast("Profile photo updated.")
            }
        } catch {
            onToast("Failed to upload photo.", "error")
        } finally {
            setUploading(false)
        }
    }

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateFanAccountAction({ firstName, lastName, email })
            if (res?.error) onToast(res.error, "error")
            else onToast("Account updated.")
        })
    }

    return (
        <div className="settings-section">
            <h2>Account Information</h2>

            {/* Avatar */}
            <div className="settings-avatar">
                <div className="settings-avatar__img">
                    {avatar ? (
                        <Image src={avatar} alt="Avatar" width={80} height={80} unoptimized />
                    ) : (
                        <span>{user.firstName.charAt(0).toUpperCase()}</span>
                    )}
                    <button
                        type="button"
                        className="settings-avatar__edit"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
                    </button>
                </div>
                <div className="settings-avatar__meta">
                    <p className="settings-avatar__name">{user.firstName} {user.lastName}</p>
                    <p className="settings-avatar__handle">@{user.username}</p>
                </div>
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatar}
                    style={{ display: "none" }}
                />
            </div>

            {/* Fields */}
            <div className="settings-grid">
                <div className="settings-field">
                    <label>First Name</label>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={isPending} />
                </div>
                <div className="settings-field">
                    <label>Last Name</label>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={isPending} />
                </div>
            </div>

            <div className="settings-field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
            </div>

            <button className="settings-save-btn" onClick={handleSave} disabled={isPending}>
                {isPending ? <><Loader2 size={15} className="spin" /> Saving…</> : "Save Changes"}
            </button>
        </div>
    )
}

// ─── Username Tab ─────────────────────────────────────────────────────────────

type AvailState = "idle" | "checking" | "available" | "taken" | "error"

const UsernameTab = ({
    user, onToast,
}: {
    user: User
    onToast: (msg: string, type?: "success" | "error") => void
}) => {
    const [username, setUsername]   = useState(user.username)
    const [avail,    setAvail]      = useState<AvailState>("idle")
    const [isPending, startTransition] = useTransition()
    const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (username === user.username) { setAvail("idle"); return }
        if (username.length < 3) { setAvail("idle"); return }

        setAvail("checking")
        if (debounce.current) clearTimeout(debounce.current)
        debounce.current = setTimeout(async () => {
            const res = await checkFanUsernameAvailability(username)
            if (res.error)         setAvail("error")
            else if (res.available) setAvail("available")
            else                    setAvail("taken")
        }, 500)

        return () => { if (debounce.current) clearTimeout(debounce.current) }
    }, [username, user.username])

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateFanUsernameAction(username)
            if (res?.error) onToast(res.error, "error")
            else onToast("Username updated.")
        })
    }

    return (
        <div className="settings-section">
            <h2>Username</h2>
            <p className="settings-desc">
                Your unique handle on NESORA. People can find you at nesora.com/@{username}
            </p>

            <div className="settings-field">
                <label>Username</label>
                <div className="settings-username-wrap">
                    <span className="settings-username-prefix">@</span>
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                        maxLength={30}
                        disabled={isPending}
                    />
                    <span className="settings-username-status">
                        {avail === "checking"  && <Loader2 size={15} className="spin" />}
                        {avail === "available" && <CheckCircle size={15} className="status-ok" />}
                        {(avail === "taken" || avail === "error") && <XCircle size={15} className="status-err" />}
                    </span>
                </div>
                {avail === "available" && <span className="settings-hint settings-hint--ok">✓ @{username} is available</span>}
                {avail === "taken"     && <span className="settings-hint settings-hint--err">This username is taken</span>}
            </div>

            <button
                className="settings-save-btn"
                onClick={handleSave}
                disabled={isPending || username === user.username || avail === "taken" || avail === "checking"}
            >
                {isPending ? <><Loader2 size={15} className="spin" /> Saving…</> : "Update Username"}
            </button>
        </div>
    )
}

// ─── Password Tab ─────────────────────────────────────────────────────────────

const PasswordTab = ({
    hasPassword, isGoogle, onToast,
}: {
    hasPassword: boolean
    isGoogle: boolean
    onToast: (msg: string, type?: "success" | "error") => void
}) => {
    const [current, setCurrent] = useState("")
    const [newPw,   setNewPw]   = useState("")
    const [confirm, setConfirm] = useState("")
    const [isPending, startTransition] = useTransition()

    if (isGoogle && !hasPassword) {
        return (
            <div className="settings-section">
                <h2>Password</h2>
                <div className="settings-info-box">
                    <p>You signed in with Google. Password management is handled through your Google account.</p>
                </div>
            </div>
        )
    }

    const handleSave = () => {
        startTransition(async () => {
            const res = await changeFanPasswordAction({
                currentPassword: current,
                newPassword:     newPw,
                confirmPassword: confirm,
            })
            if (res?.error) onToast(res.error, "error")
            else {
                onToast("Password changed.")
                setCurrent(""); setNewPw(""); setConfirm("")
            }
        })
    }

    return (
        <div className="settings-section">
            <h2>Change Password</h2>

            <div className="settings-field">
                <label>Current Password</label>
                <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={isPending} />
            </div>
            <div className="settings-field">
                <label>New Password</label>
                <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} disabled={isPending} />
                <span className="settings-hint">At least 8 characters, one uppercase, one number, one special character.</span>
            </div>
            <div className="settings-field">
                <label>Confirm New Password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={isPending} />
            </div>

            <button className="settings-save-btn" onClick={handleSave} disabled={isPending || !current || !newPw || !confirm}>
                {isPending ? <><Loader2 size={15} className="spin" /> Updating…</> : "Update Password"}
            </button>
        </div>
    )
}

// ─── Interests Tab ────────────────────────────────────────────────────────────

const InterestsTab = ({
    initial, onToast,
}: {
    initial: Category[]
    onToast: (msg: string, type?: "success" | "error") => void
}) => {
    const [selected, setSelected] = useState<Category[]>(initial)
    const [isPending, startTransition] = useTransition()

    const toggle = (cat: Category) => {
        setSelected((prev) =>
            prev.includes(cat)
                ? prev.filter((c) => c !== cat)
                : prev.length >= 10 ? prev : [...prev, cat]
        )
    }

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateFanInterestsAction(selected)
            if (res?.error) onToast(res.error, "error")
            else onToast("Interests updated.")
        })
    }

    return (
        <div className="settings-section">
            <h2>Your Interests</h2>
            <p className="settings-desc">
                Pick what you love. We use these to recommend creators and content. ({selected.length}/10)
            </p>

            <div className="settings-interests-grid">
                {CATEGORIES.map((cat) => {
                    const isSelected = selected.includes(cat.value)
                    return (
                        <button
                            key={cat.value}
                            type="button"
                            className={`settings-interest ${isSelected ? "settings-interest--active" : ""}`}
                            onClick={() => toggle(cat.value)}
                        >
                            <span>{cat.emoji}</span>
                            <span>{cat.label}</span>
                        </button>
                    )
                })}
            </div>

            <button className="settings-save-btn" onClick={handleSave} disabled={isPending || selected.length < 1}>
                {isPending ? <><Loader2 size={15} className="spin" /> Saving…</> : "Save Interests"}
            </button>
        </div>
    )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

const NotificationsTab = ({
    onToast,
}: {
    onToast: (msg: string, type?: "success" | "error") => void
}) => {
    const [prefs, setPrefs] = useState<Record<string, boolean>>({})
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        startTransition(async () => {
            const data = await getFanNotificationPrefsAction()
            setPrefs(data as Record<string, boolean>)
            setLoading(false)
        })
    }, [])

    const ITEMS = [
        { key: "newPostFromFollowed",  label: "New posts from creators you follow" },
        { key: "creatorGoesLive",      label: "When a creator goes live" },
        { key: "subscriptionExpiring", label: "Subscription expiring soon" },
        { key: "messageReceived",      label: "New messages" },
        { key: "emailNewPost",         label: "Email: new posts" },
        { key: "emailSubscription",    label: "Email: subscription updates" },
    ]

    const toggle = (key: string) => {
        const updated = { ...prefs, [key]: !prefs[key] }
        setPrefs(updated)
        startTransition(async () => {
            await updateFanNotificationPrefsAction(updated)
        })
    }

    if (loading) {
        return <div className="settings-section"><Loader2 size={20} className="spin" /></div>
    }

    return (
        <div className="settings-section">
            <h2>Notifications</h2>
            <div className="settings-toggles">
                {ITEMS.map((item) => (
                    <div key={item.key} className="settings-toggle-row">
                        <span>{item.label}</span>
                        <button
                            type="button"
                            className={`settings-switch ${prefs[item.key] ? "settings-switch--on" : ""}`}
                            onClick={() => toggle(item.key)}
                            role="switch"
                            aria-checked={prefs[item.key]}
                        >
                            <span className="settings-switch__knob" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ─── Danger Tab ───────────────────────────────────────────────────────────────

const DangerTab = ({
    hasPassword, onToast,
}: {
    hasPassword: boolean
    onToast: (msg: string, type?: "success" | "error") => void
}) => {
    const [showConfirm, setShowConfirm] = useState(false)
    const [password,    setPassword]    = useState("")
    const [isPending,   startTransition] = useTransition()

    const handleDelete = () => {
        startTransition(async () => {
            const res = await deleteFanAccountAction(hasPassword ? password : undefined)
            if (res?.error) onToast(res.error, "error")
            // On success the action signs out + redirects
        })
    }

    return (
        <div className="settings-section">
            <h2>Delete Account</h2>
            <div className="settings-danger-box">
                <AlertTriangle size={20} />
                <div>
                    <p className="settings-danger-box__title">This action is permanent</p>
                    <p className="settings-danger-box__text">
                        Deleting your account removes all your data, subscriptions, saved posts,
                        and wallet balance. This cannot be undone.
                    </p>
                </div>
            </div>

            {!showConfirm ? (
                <button
                    type="button"
                    className="settings-delete-btn"
                    onClick={() => setShowConfirm(true)}
                >
                    Delete My Account
                </button>
            ) : (
                <div className="settings-delete-confirm">
                    {hasPassword && (
                        <div className="settings-field">
                            <label>Enter your password to confirm</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={isPending}
                            />
                        </div>
                    )}
                    <div className="settings-delete-actions">
                        <button
                            type="button"
                            className="settings-delete-btn settings-delete-btn--final"
                            onClick={handleDelete}
                            disabled={isPending || (hasPassword && !password)}
                        >                            
                            {isPending ? <><Loader2 size={15} className="spin" /> Deleting…</> : "Permanently Delete"}
                        </button>
                        <button
                            type="button"
                            className="settings-cancel-btn"
                            onClick={() => { setShowConfirm(false); setPassword("") }}
                            disabled={isPending}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Display Theme Tab ────────────────────────────────────────────────────────

const DisplayTab = () => {
    const { theme, setTheme } = useFanTheme()

    return (
        <div className="settings-section">
            <h2>Display Theme</h2>
            <p className="settings-desc">
                Customize how NESORA looks for you. Choose between light and dark themes.
            </p>
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
    )
}