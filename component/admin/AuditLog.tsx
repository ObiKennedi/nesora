// component/admin/AuditLog.tsx
"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Search, X, ChevronDown, ChevronUp } from "lucide-react"

const CATEGORIES = [
    { value: "all",        label: "All" },
    { value: "withdrawal", label: "Payouts" },
    { value: "kyc",        label: "KYC" },
    { value: "user",       label: "Users" },
] as const

// Human labels for known actions; unknown actions fall back to the raw string
const ACTION_LABELS: Record<string, string> = {
    "withdrawal.approve": "Approved withdrawal",
    "withdrawal.reject":  "Rejected withdrawal",
    "kyc.approve":        "Approved KYC",
    "kyc.reject":         "Rejected KYC",
    "user.suspend":       "Suspended user",
    "user.unsuspend":     "Lifted suspension",
}

const ACTION_TONE: Record<string, "positive" | "negative" | "neutral"> = {
    "withdrawal.approve": "positive",
    "withdrawal.reject":  "negative",
    "kyc.approve":        "positive",
    "kyc.reject":         "negative",
    "user.suspend":       "negative",
    "user.unsuspend":     "positive",
}

type Entry = {
    id:         string
    action:     string
    targetType: string
    targetId:   string
    metadata:   Record<string, unknown> | null
    createdAt:  string
    admin: {
        id:        string
        firstName: string
        lastName:  string
        email:     string
        image:     string | null
    }
}

type Props = {
    entries:        Entry[]
    admins:         { id: string; firstName: string; lastName: string }[]
    activeCategory: string
    activeAdminId:  string
    targetQuery:    string
    page:           number
    pages:          number
}

const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString("en-NG", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    })

export function AuditLog({
    entries,
    admins,
    activeCategory,
    activeAdminId,
    targetQuery,
    page,
    pages,
}: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [targetInput, setTargetInput] = useState(targetQuery)
    const [expanded, setExpanded]       = useState<string | null>(null)

    const setParams = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") params.delete(key)
            else params.set(key, value)
        }
        router.push(`/admin/audit?${params.toString()}`)
    }

    return (
        <div className="audit-log">
            {/* ── Filters ── */}
            <div className="audit-log__toolbar">
                <div className="audit-log__categories">
                    {CATEGORIES.map((c) => (
                        <button
                            key={c.value}
                            type="button"
                            className={`audit-log__category${
                                activeCategory === c.value ? " audit-log__category--active" : ""
                            }`}
                            onClick={() => setParams({ category: c.value, page: null })}
                        >
                            {c.label}
                        </button>
                    ))}
                </div>

                <select
                    className="audit-log__admin-select"
                    value={activeAdminId}
                    onChange={(e) => setParams({ admin: e.target.value || null, page: null })}
                >
                    <option value="">All admins</option>
                    {admins.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.firstName} {a.lastName}
                        </option>
                    ))}
                </select>

                <div className="audit-log__search">
                    <Search size={15} className="audit-log__search-icon" />
                    <input
                        type="text"
                        className="audit-log__search-input"
                        placeholder="Filter by exact target ID…"
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && setParams({ target: targetInput, page: null })
                        }
                    />
                    {targetInput && (
                        <button
                            type="button"
                            className="audit-log__search-clear"
                            onClick={() => { setTargetInput(""); setParams({ target: null, page: null }) }}
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Entries ── */}
            {entries.length === 0 ? (
                <div className="audit-log__empty">No audit entries match these filters.</div>
            ) : (
                <div className="audit-log__table-wrap">
                    <table className="audit-log__table">
                        <thead>
                            <tr>
                                <th>When</th>
                                <th>Admin</th>
                                <th>Action</th>
                                <th>Target</th>
                                <th aria-label="Expand" />
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => {
                                const isOpen  = expanded === e.id
                                const hasMeta = e.metadata && Object.keys(e.metadata).length > 0
                                const tone    = ACTION_TONE[e.action] ?? "neutral"

                                return (
                                    <FragmentRow
                                        key={e.id}
                                        entry={e}
                                        isOpen={isOpen}
                                        hasMeta={!!hasMeta}
                                        tone={tone}
                                        onToggle={() =>
                                            setExpanded(isOpen ? null : e.id)
                                        }
                                    />
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {pages > 1 && (
                <div className="audit-log__pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                        Previous
                    </button>
                    <span>Page {page} of {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })}>
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}

function FragmentRow({
    entry,
    isOpen,
    hasMeta,
    tone,
    onToggle,
}: {
    entry:    Entry
    isOpen:   boolean
    hasMeta:  boolean
    tone:     "positive" | "negative" | "neutral"
    onToggle: () => void
}) {
    return (
        <>
            <tr
                className={`audit-log__row${hasMeta ? " audit-log__row--expandable" : ""}`}
                onClick={hasMeta ? onToggle : undefined}
            >
                <td className="audit-log__when">{fmtDateTime(entry.createdAt)}</td>
                <td>
                    <div className="audit-log__admin">
                        {entry.admin.image ? (
                            <Image
                                src={entry.admin.image}
                                alt=""
                                width={24}
                                height={24}
                                className="audit-log__avatar"
                            />
                        ) : (
                            <span className="audit-log__avatar audit-log__avatar--fallback">
                                {entry.admin.firstName.charAt(0)}
                            </span>
                        )}
                        <span>{entry.admin.firstName} {entry.admin.lastName}</span>
                    </div>
                </td>
                <td>
                    <span className={`audit-log__action audit-log__action--${tone}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                    </span>
                </td>
                <td className="audit-log__target">
                    <span className="audit-log__target-type">{entry.targetType}</span>
                    <code className="audit-log__target-id">{entry.targetId}</code>
                </td>
                <td className="audit-log__chevron">
                    {hasMeta && (isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />)}
                </td>
            </tr>
            {isOpen && entry.metadata && (
                <tr className="audit-log__meta-row">
                    <td colSpan={5}>
                        <pre className="audit-log__meta">
                            {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                    </td>
                </tr>
            )}
        </>
    )
}