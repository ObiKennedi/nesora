// components/creator/verification/VerificationPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, Shield } from "lucide-react"
import { getVerificationStatusAction } from "@/actions/creator/verification"
import { TrustBadge }            from "./TrustBadge"
import { PersonalInfoForm }      from "./PersonalInfoForm"
import { IdentityDocumentsForm } from "./IdentityDocumentsForm"
import { SelfieVerification }    from "./SelfieVerification"
import { AddressVerification }   from "./AddressVerification"
import "@/styles/creator/verification/VerificationPage.scss"

type Data = Awaited<ReturnType<typeof getVerificationStatusAction>>

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
    APPROVED: {
        label: "Verified",
        color: "green",
        icon:  <ShieldCheck size={20} />,
        desc:  "Your identity has been verified. You have full access to all creator features.",
    },
    PENDING: {
        label: "Pending Review",
        color: "amber",
        icon:  <ShieldAlert size={20} />,
        desc:  "Your documents are under review. This usually takes 24–48 hours.",
    },
    REJECTED: {
        label: "Rejected",
        color: "red",
        icon:  <ShieldX size={20} />,
        desc:  "Your submission was rejected. Please review the feedback and resubmit.",
    },
}

export const VerificationPage = () => {

    const [data,      setData]      = useState<Data | null>(null)
    const [isPending, startTransition] = useTransition()

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const res = await getVerificationStatusAction()
            setData(res)
        })
    }, [])

    useEffect(() => { fetchData() }, [fetchData])

    if (isPending && !data) {
        return (
            <div className="verification-page__loading">
                <Loader2 size={24} className="spin" />
            </div>
        )
    }

    if (!data) return null

    const status = data.creator.verificationStatus
    const config = statusConfig[status] ?? statusConfig.PENDING

    return (
        <div className="verification-page">

            {/* ── Status banner ── */}
            <div className={`verif-status-banner verif-status-banner--${config.color}`}>
                <span className="verif-status-banner__icon">{config.icon}</span>
                <div>
                    <p className="verif-status-banner__label">{config.label}</p>
                    <p className="verif-status-banner__desc">{config.desc}</p>
                    {status === "REJECTED" && data.verification?.rejectionReason && (
                        <p className="verif-status-banner__reason">
                            <strong>Admin feedback:</strong> {data.verification.rejectionReason}
                        </p>
                    )}
                </div>
            </div>

            <div className="verification-page__body">

                {/* ── Main column ── */}
                <div className="verification-page__main">

                    <PersonalInfoForm
                        profile={data.profile}
                        onSuccess={fetchData}
                    />

                    <IdentityDocumentsForm
                        verification={data.verification}
                        onSuccess={fetchData}
                    />

                    <SelfieVerification
                        verification={data.verification}
                        onSuccess={fetchData}
                    />

                    <AddressVerification
                        verification={data.verification}
                        onSuccess={fetchData}
                    />

                </div>

                {/* ── Sidebar ── */}
                <aside className="verification-page__aside">
                    <TrustBadge
                        progress={data.progress}
                        trustScore={data.trustScore}
                        steps={data.steps}
                    />
                </aside>

            </div>

        </div>
    )
}