// components/creator/profile/ProfilePage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import Link                                                from "next/link"
import { Loader2, ExternalLink, Repeat }                   from "lucide-react"
import { getCreatorProfileAction }                         from "@/actions/creator/profile"
import { AvatarBannerSection }  from "./AvatarBannerSection"
import { BasicInfoForm }        from "./BasicInfoForm"
import { SocialLinksForm }      from "./SocialLinksForm"
import { BrandingForm }         from "./BrandingForm"
import { ProfilePreview }       from "./ProfilePreview"
import "@/styles/creator/profile/ProfilePage.scss"

type ProfileData = Awaited<ReturnType<typeof getCreatorProfileAction>>

export const ProfilePage = () => {

    const [data, setData] = useState<ProfileData | null>(null)
    const [isPending, startTransition] = useTransition()

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const res = await getCreatorProfileAction()
            setData(res)
        })
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    if (isPending && !data) {
        return (
            <div className="profile-page__loading">
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    if (!data) return null

    const { creator, user } = data
    const profileUrl = `/fan/${creator.handle ?? creator.id}`

    return (
        <div className="profile-page">

            {/* ── Header ── */}
            <div className="profile-page__header">
                <div>
                    <h2>Profile Management</h2>
                    <p>Manage how you appear to your audience</p>
                </div>
                <div className="profile-page__header-actions">
                    <Link href="/fan/feed" className="profile-page__fan-btn">
                        <Repeat size={14} />
                        Switch to Fan Mode
                    </Link>
                    <Link
                        href={profileUrl}
                        className="profile-page__view-btn"
                    >
                        <ExternalLink size={14} />
                        View Public Profile
                    </Link>
                </div>
            </div>

            <div className="profile-page__body">

                {/* ── Left: forms ── */}
                <div className="profile-page__forms">

                    <AvatarBannerSection
                        avatar={user?.image ?? null}
                        banner={creator.bannerImage ?? null}
                        displayName={creator.displayName}
                        handle={creator.handle ?? null}
                        onSuccess={fetchData}
                    />

                    <BasicInfoForm
                        creator={creator}
                        user={user}
                        onSuccess={fetchData}
                    />

                    <SocialLinksForm
                        creator={creator}
                        onSuccess={fetchData}
                    />

                    <BrandingForm
                        creator={creator}
                        onSuccess={fetchData}
                    />

                </div>

                {/* ── Right: live preview ── */}
                <aside className="profile-page__preview">
                    <ProfilePreview
                        creator={creator}
                        user={user}
                    />
                </aside>

            </div>

        </div>
    )
}