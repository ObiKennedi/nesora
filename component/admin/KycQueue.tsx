// component/admin/KycQueue.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { approveKycAction, rejectKycAction } from "@/actions/admin/kyc"
import { Loader2, CheckCircle2, XCircle, X, ZoomIn } from "lucide-react"

const TABS = [
    { value: "PENDING",  label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
] as const

const ID_TYPE_LABELS: Record<string, string> = {
    NATIONAL_ID:     "National ID",
    PASSPORT:        "Passport",
    DRIVERS_LICENSE: "Driver's License",
    VOTERS_CARD:     "Voter's Card",
}

type Verification = {
    id:                string
    status:            string
    dateOfBirth:       string
    idType:            string
    idNumber:          string
    idFrontImage:      string
    idBackImage:       string
    selfieImage:       string | null
    addressLine:       string | null
    addressCity:       string | null
    addressState:      string | null
    addressCountry:    string | null
    addressProofImage: string | null
    bvnOrTaxId:        string | null
    rejectionReason:   string | null
    createdAt:         string
    reviewedAt:        string | null
    reviewedBy:        { firstName: string; lastName: string } | null
    creator: {
        id:               string
        displayName:      string
        handle:           string | null
        createdAt:        string
        followersCount:   number
        subscribersCount: number
        creatorCategories: { category: string }[]
        user: {
            id:        string
            email:     string
            image:     string | null
            firstName: string
            lastName:  string
            country:   string | null
            city:      string | null
            createdAt: string
        }
    }
}

type Props = {
    verifications: Verification[]
    activeStatus:  string
    page:          number
    pages:         number
}

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

export function KycQueue({ verifications, activeStatus, page, pages }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [selected, setSelected]       = useState<Verification | null>(null)
    const [lightbox, setLightbox]       = useState<string | null>(null)
    const [rejectOpen, setRejectOpen]   = useState(false)
    const [rejectReason, setReason]     = useState("")
    const [error, setError]             = useState<string | null>(null)

    const setParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set(key, value)
        if (key === "status") params.delete("page")
        router.push(`/admin/kyc?${params.toString()}`)
    }

    const closeDetail = () => {
        setSelected(null)
        setRejectOpen(false)
        setReason("")
        setError(null)
    }

    const handleApprove = () => {
        if (!selected) return

        setError(null)
        startTransition(async () => {
            const res = await approveKycAction(selected.id)
            if ("error" in res && res.error) {
                setError(res.error)
            } else {
                closeDetail()
                router.refresh()
            }
        })
    }

    const handleReject = () => {
        if (!selected) return

        setError(null)
        startTransition(async () => {
            const res = await rejectKycAction({
                verificationId: selected.id,
                reason:         rejectReason,
            })
            if ("error" in res && res.error) {
                setError(res.error)
            } else {
                closeDetail()
                router.refresh()
            }
        })
    }

    const documents = selected
        ? ([
              { label: `${ID_TYPE_LABELS[selected.idType] ?? selected.idType} — Front`, url: selected.idFrontImage },
              { label: `${ID_TYPE_LABELS[selected.idType] ?? selected.idType} — Back`,  url: selected.idBackImage },
              ...(selected.selfieImage       ? [{ label: "Selfie",         url: selected.selfieImage }]       : []),
              ...(selected.addressProofImage ? [{ label: "Proof of address", url: selected.addressProofImage }] : []),
          ] as { label: string; url: string }[])
        : []

    const age = selected
        ? Math.floor((Date.now() - new Date(selected.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 0

    return (
        <div className="kyc-queue">
            {/* ── Status tabs ── */}
            <div className="kyc-queue__tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        className={`kyc-queue__tab${
                            activeStatus === tab.value ? " kyc-queue__tab--active" : ""
                        }`}
                        onClick={() => setParam("status", tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Applicant list ── */}
            {verifications.length === 0 ? (
                <div className="kyc-queue__empty">
                    No {activeStatus.toLowerCase()} verifications.
                </div>
            ) : (
                <div className="kyc-queue__list">
                    {verifications.map((v) => (
                        <button
                            key={v.id}
                            type="button"
                            className="kyc-queue__card"
                            onClick={() => { setSelected(v); setError(null) }}
                        >
                            {v.creator.user.image ? (
                                <Image
                                    src={v.creator.user.image}
                                    alt={v.creator.displayName}
                                    width={40}
                                    height={40}
                                    className="kyc-queue__avatar"
                                />
                            ) : (
                                <span className="kyc-queue__avatar kyc-queue__avatar--fallback">
                                    {v.creator.displayName.charAt(0)}
                                </span>
                            )}
                            <div className="kyc-queue__card-info">
                                <span className="kyc-queue__card-name">{v.creator.displayName}</span>
                                <span className="kyc-queue__card-meta">
                                    @{v.creator.handle ?? "—"} · {ID_TYPE_LABELS[v.idType] ?? v.idType}
                                </span>
                            </div>
                            <span className="kyc-queue__card-date">
                                {fmtDate(v.createdAt)}
                            </span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Pagination ── */}
            {pages > 1 && (
                <div className="kyc-queue__pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>
                        Previous
                    </button>
                    <span>Page {page} of {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>
                        Next
                    </button>
                </div>
            )}

            {/* ── Detail panel ── */}
            {selected && (
                <div className="kyc-queue__overlay" onClick={closeDetail}>
                    <div className="kyc-queue__panel" onClick={(e) => e.stopPropagation()}>
                        <div className="kyc-queue__panel-header">
                            <h2 className="kyc-queue__panel-title">{selected.creator.displayName}</h2>
                            <button type="button" className="kyc-queue__panel-close" onClick={closeDetail}>
                                <X size={18} />
                            </button>
                        </div>

                        {error && <p className="kyc-queue__error">{error}</p>}

                        {/* Identity vs. account cross-check */}
                        <section className="kyc-queue__section">
                            <h3 className="kyc-queue__section-title">Applicant</h3>
                            <dl className="kyc-queue__facts">
                                <div><dt>Legal name (account)</dt><dd>{selected.creator.user.firstName} {selected.creator.user.lastName}</dd></div>
                                <div><dt>Email</dt><dd>{selected.creator.user.email}</dd></div>
                                <div><dt>Date of birth</dt><dd>{fmtDate(selected.dateOfBirth)} ({age} yrs)</dd></div>
                                <div><dt>ID type</dt><dd>{ID_TYPE_LABELS[selected.idType] ?? selected.idType}</dd></div>
                                <div><dt>ID number</dt><dd>{selected.idNumber}</dd></div>
                                {selected.bvnOrTaxId && <div><dt>BVN / Tax ID</dt><dd>{selected.bvnOrTaxId}</dd></div>}
                                <div><dt>Location (account)</dt><dd>{[selected.creator.user.city, selected.creator.user.country].filter(Boolean).join(", ") || "—"}</dd></div>
                                {(selected.addressLine || selected.addressCity) && (
                                    <div><dt>Address (submitted)</dt><dd>{[selected.addressLine, selected.addressCity, selected.addressState, selected.addressCountry].filter(Boolean).join(", ")}</dd></div>
                                )}
                                <div><dt>Account created</dt><dd>{fmtDate(selected.creator.user.createdAt)}</dd></div>
                                <div><dt>Audience</dt><dd>{selected.creator.followersCount.toLocaleString()} followers · {selected.creator.subscribersCount.toLocaleString()} subscribers</dd></div>
                            </dl>
                        </section>

                        {/* Documents */}
                        <section className="kyc-queue__section">
                            <h3 className="kyc-queue__section-title">Documents</h3>
                            <div className="kyc-queue__docs">
                                {documents.map((doc) => (
                                    <figure key={doc.label} className="kyc-queue__doc">
                                        <button
                                            type="button"
                                            className="kyc-queue__doc-thumb"
                                            onClick={() => setLightbox(doc.url)}
                                        >
                                            {/* Plain <img>: Cloudinary URLs, arbitrary aspect ratios,
                                                admin-only page — next/image adds config friction for no win */}
                                            <img src={doc.url} alt={doc.label} loading="lazy" />
                                            <span className="kyc-queue__doc-zoom"><ZoomIn size={16} /></span>
                                        </button>
                                        <figcaption className="kyc-queue__doc-label">{doc.label}</figcaption>
                                    </figure>
                                ))}
                            </div>
                        </section>

                        {/* Prior review info for APPROVED/REJECTED tabs */}
                        {selected.status !== "PENDING" && (
                            <section className="kyc-queue__section">
                                <h3 className="kyc-queue__section-title">Review</h3>
                                <dl className="kyc-queue__facts">
                                    <div><dt>Status</dt><dd>{selected.status}</dd></div>
                                    {selected.reviewedBy && (
                                        <div><dt>Reviewed by</dt><dd>{selected.reviewedBy.firstName} {selected.reviewedBy.lastName}</dd></div>
                                    )}
                                    {selected.reviewedAt && <div><dt>Reviewed at</dt><dd>{fmtDate(selected.reviewedAt)}</dd></div>}
                                    {selected.rejectionReason && <div><dt>Rejection reason</dt><dd>{selected.rejectionReason}</dd></div>}
                                </dl>
                            </section>
                        )}

                        {/* Actions — PENDING only */}
                        {selected.status === "PENDING" && !rejectOpen && (
                            <div className="kyc-queue__actions">
                                <button
                                    type="button"
                                    className="kyc-queue__btn kyc-queue__btn--reject"
                                    disabled={isPending}
                                    onClick={() => setRejectOpen(true)}
                                >
                                    <XCircle size={15} /> Reject
                                </button>
                                <button
                                    type="button"
                                    className="kyc-queue__btn kyc-queue__btn--approve"
                                    disabled={isPending}
                                    onClick={handleApprove}
                                >
                                    {isPending ? <Loader2 size={15} className="kyc-queue__spinner" /> : <CheckCircle2 size={15} />}
                                    Approve verification
                                </button>
                            </div>
                        )}

                        {selected.status === "PENDING" && rejectOpen && (
                            <div className="kyc-queue__reject-form">
                                <textarea
                                    className="kyc-queue__reject-input"
                                    placeholder="Reason shown to the creator — e.g. 'ID photo is blurry, please re-upload a clear photo of the front of your National ID.'"
                                    value={rejectReason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                />
                                <div className="kyc-queue__actions">
                                    <button
                                        type="button"
                                        className="kyc-queue__btn"
                                        onClick={() => { setRejectOpen(false); setReason("") }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="kyc-queue__btn kyc-queue__btn--reject"
                                        disabled={rejectReason.trim().length < 10 || isPending}
                                        onClick={handleReject}
                                    >
                                        {isPending ? <Loader2 size={15} className="kyc-queue__spinner" /> : <XCircle size={15} />}
                                        Confirm rejection
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Lightbox ── */}
            {lightbox && (
                <div className="kyc-queue__lightbox" onClick={() => setLightbox(null)}>
                    <img src={lightbox} alt="Document" />
                </div>
            )}
        </div>
    )
}