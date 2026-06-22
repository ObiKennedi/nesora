// components/creator/profile/AvatarBannerSection.tsx
"use client"

import { useRef, useState, useTransition } from "react"
import { Camera, ImagePlus, Loader2 }      from "lucide-react"
import { updateAvatarAction, updateBannerAction } from "@/actions/creator/profile"
import "@/styles/creator/profile/AvatarBannerSection.scss"

type Props = {
    avatar:      string | null
    banner:      string | null
    displayName: string
    handle:      string | null
    onSuccess:   () => void
}

const upload = async (file: File, folder: string) => {
    const form = new FormData()
    form.append("file",          file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        `nesora/${folder}`)

    const res  = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: form }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message)
    return data.secure_url as string
}

export const AvatarBannerSection = ({
    avatar, banner, displayName, handle, onSuccess,
}: Props) => {

    const [localAvatar,  setLocalAvatar]  = useState(avatar)
    const [localBanner,  setLocalBanner]  = useState(banner)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [uploadingBanner, setUploadingBanner] = useState(false)
    const [isPending,    startTransition] = useTransition()

    const avatarRef = useRef<HTMLInputElement>(null)
    const bannerRef = useRef<HTMLInputElement>(null)

    const handleAvatar = async (file: File) => {
        setUploadingAvatar(true)
        try {
            const url = await upload(file, "avatars")
            setLocalAvatar(url)
            startTransition(async () => {
                await updateAvatarAction(url)
                onSuccess()
            })
        } finally { setUploadingAvatar(false) }
    }

    const handleBanner = async (file: File) => {
        setUploadingBanner(true)
        try {
            const url = await upload(file, "banners")
            setLocalBanner(url)
            startTransition(async () => {
                await updateBannerAction(url)
                onSuccess()
            })
        } finally { setUploadingBanner(false) }
    }

    return (
        <div className="avatar-banner-section">

            {/* ── Banner ── */}
            <div
                className="avatar-banner-section__banner"
                style={{ backgroundImage: localBanner ? `url(${localBanner})` : undefined }}
                onClick={() => bannerRef.current?.click()}
            >
                {!localBanner && (
                    <div className="avatar-banner-section__banner-placeholder">
                        <ImagePlus size={20} />
                        <span>Add a banner image</span>
                    </div>
                )}
                <div className="avatar-banner-section__banner-overlay">
                    {uploadingBanner
                        ? <Loader2 size={18} className="spin" />
                        : <><Camera size={16} /> Change banner</>
                    }
                </div>
                <input
                    ref={bannerRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleBanner(f)
                    }}
                />
            </div>

            {/* ── Avatar ── */}
            <div className="avatar-banner-section__bottom">
                <div
                    className="avatar-banner-section__avatar-wrap"
                    onClick={() => avatarRef.current?.click()}
                >
                    {localAvatar ? (
                        <img src={localAvatar} alt={displayName} />
                    ) : (
                        <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                    <div className="avatar-banner-section__avatar-overlay">
                        {uploadingAvatar
                            ? <Loader2 size={14} className="spin" />
                            : <Camera  size={14} />
                        }
                    </div>
                    <input
                        ref={avatarRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) handleAvatar(f)
                        }}
                    />
                </div>

                <div className="avatar-banner-section__identity">
                    <p className="avatar-banner-section__name">{displayName}</p>
                    {handle && (
                        <p className="avatar-banner-section__handle">@{handle}</p>
                    )}
                </div>
            </div>

        </div>
    )
}