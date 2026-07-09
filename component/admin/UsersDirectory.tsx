// component/admin/UsersDirectory.tsx
"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import {
    getUserDetailAction,
    suspendUserAction,
    unsuspendUserAction,
} from "@/actions/admin/users"
import { Loader2, Search, ShieldCheck, Ban, RotateCcw, X } from "lucide-react"

const FILTERS = [
    { value: "all",       label: "All" },
    { value: "creators",  label: "Creators" },
    { value: "fans",      label: "Fans" },
    { value: "suspended", label: "Suspended" },
] as const

type UserRow = {
    id:             string
    email:          string
    username:       string
    firstName:      string
    lastName:       string
    image:          string | null
    role:           string
    onboardingType: string | null
    isSuspended:    boolean
    createdAt:      string
    creator: {
        id:          string
        displayName: string
        handle:      string | null
        isVerified:  boolean
    } | null
}

type WalletTx = {
    id:          string
    amount:      string | number
    type:        string
    description: string | null
    createdAt:   string
}

type UserDetail = UserRow & {
    emailVerified:    string | null
    suspendedAt:      string | null
    suspensionReason: string | null
    country:          string | null
    city:             string | null
    wallet: { balance: string | number; transactions: WalletTx[] } | null
    creator:
        | (NonNullable<UserRow["creator"]> & {
              verificationStatus: string
              followersCount:     number
              subscribersCount:   number
              trustScore:         number
              createdAt:          string
              wallet: { balance: string | number; transactions: WalletTx[] } | null
              _count: { posts: number; streams: number; withdrawals: number }
          })
        | null
    _count: { subscriptions: number; follows: number; giftsSent: number }
}

type Props = {
    users:        UserRow[]
    q:            string
    activeFilter: string
    page:         number
    pages:        number
}

const naira   = (v: string | number) => `₦${Number(v).toLocaleString()}`
const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })

export function UsersDirectory({ users, q, activeFilter, page, pages }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isPending, startTransition] = useTransition()

    const [searchInput, setSearchInput] = useState(q)
    const [detail, setDetail]           = useState<UserDetail | null>(null)
    const [loadingDetail, setLoading]   = useState(false)
    const [suspendOpen, setSuspendOpen] = useState(false)
    const [suspendReason, setReason]    = useState("")
    const [error, setError]             = useState<string | null>(null)

    const setParams = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === "") params.delete(key)
            else params.set(key, value)
        }
        router.push(`/admin/users?${params.toString()}`)
    }

    const submitSearch = () => setParams({ q: searchInput, page: null })

    const openDetail = (userId: string) => {
        setLoading(true)
        setError(null)
        setSuspendOpen(false)
        setReason("")
        startTransition(async () => {
            const res = await getUserDetailAction(userId)
            if ("error" in res && res.error) setError(res.error)
            else if ("user" in res) setDetail(res.user as UserDetail)
            setLoading(false)
        })
    }

    const closeDetail = () => {
        setDetail(null)
        setSuspendOpen(false)
        setReason("")
        setError(null)
    }

    const handleSuspend = () => {
        if (!detail) return
        setError(null)
        startTransition(async () => {
            const res = await suspendUserAction({ userId: detail.id, reason: suspendReason })
            if ("error" in res && res.error) {
                setError(res.error)
            } else {
                closeDetail()
                router.refresh()
            }
        })
    }

    const handleUnsuspend = () => {
        if (!detail) return
        if (!confirm(`Lift the suspension on ${detail.firstName} ${detail.lastName}?`)) return
        setError(null)
        startTransition(async () => {
            const res = await unsuspendUserAction(detail.id)
            if ("error" in res && res.error) {
                setError(res.error)
            } else {
                closeDetail()
                router.refresh()
            }
        })
    }

    return (
        <div className="users-directory">
            {/* ── Search + filters ── */}
            <div className="users-directory__toolbar">
                <div className="users-directory__search">
                    <Search size={16} className="users-directory__search-icon" />
                    <input
                        type="text"
                        className="users-directory__search-input"
                        placeholder="Search email, username, name, or handle…"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitSearch()}
                    />
                    {searchInput && (
                        <button
                            type="button"
                            className="users-directory__search-clear"
                            onClick={() => { setSearchInput(""); setParams({ q: null, page: null }) }}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="users-directory__filters">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            className={`users-directory__filter${
                                activeFilter === f.value ? " users-directory__filter--active" : ""
                            }`}
                            onClick={() => setParams({ filter: f.value, page: null })}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && !detail && <p className="users-directory__error">{error}</p>}

            {/* ── Table ── */}
            {users.length === 0 ? (
                <div className="users-directory__empty">No users found.</div>
            ) : (
                <div className="users-directory__table-wrap">
                    <table className="users-directory__table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr
                                    key={u.id}
                                    className="users-directory__row"
                                    onClick={() => openDetail(u.id)}
                                >
                                    <td>
                                        <div className="users-directory__user">
                                            {u.image ? (
                                                <Image
                                                    src={u.image}
                                                    alt={u.username}
                                                    width={32}
                                                    height={32}
                                                    className="users-directory__avatar"
                                                />
                                            ) : (
                                                <span className="users-directory__avatar users-directory__avatar--fallback">
                                                    {u.firstName.charAt(0)}
                                                </span>
                                            )}
                                            <div>
                                                <span className="users-directory__user-name">
                                                    {u.firstName} {u.lastName}
                                                    {u.creator?.isVerified && (
                                                        <ShieldCheck size={13} className="users-directory__verified" />
                                                    )}
                                                </span>
                                                <span className="users-directory__user-meta">
                                                    @{u.creator?.handle ?? u.username} · {u.email}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className="users-directory__type">
                                            {u.role === "ADMIN"
                                                ? "Admin"
                                                : u.creator
                                                ? "Creator"
                                                : u.onboardingType === "FAN"
                                                ? "Fan"
                                                : "Unonboarded"}
                                        </span>
                                    </td>
                                    <td>
                                        {u.isSuspended ? (
                                            <span className="users-directory__badge users-directory__badge--suspended">
                                                Suspended
                                            </span>
                                        ) : (
                                            <span className="users-directory__badge users-directory__badge--active">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="users-directory__date">{fmtDate(u.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {pages > 1 && (
                <div className="users-directory__pagination">
                    <button type="button" disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) })}>
                        Previous
                    </button>
                    <span>Page {page} of {pages}</span>
                    <button type="button" disabled={page >= pages} onClick={() => setParams({ page: String(page + 1) })}>
                        Next
                    </button>
                </div>
            )}

            {/* ── Loading overlay for detail fetch ── */}
            {loadingDetail && (
                <div className="users-directory__overlay">
                    <Loader2 size={28} className="users-directory__spinner users-directory__spinner--page" />
                </div>
            )}

            {/* ── Detail panel ── */}
            {detail && !loadingDetail && (
                <div className="users-directory__overlay" onClick={closeDetail}>
                    <div className="users-directory__panel" onClick={(e) => e.stopPropagation()}>
                        <div className="users-directory__panel-header">
                            <h2 className="users-directory__panel-title">
                                {detail.firstName} {detail.lastName}
                            </h2>
                            <button type="button" className="users-directory__panel-close" onClick={closeDetail}>
                                <X size={18} />
                            </button>
                        </div>

                        {error && <p className="users-directory__error">{error}</p>}

                        {detail.isSuspended && (
                            <div className="users-directory__suspended-banner">
                                <Ban size={15} />
                                <span>
                                    Suspended {detail.suspendedAt ? fmtDate(detail.suspendedAt) : ""} —{" "}
                                    {detail.suspensionReason ?? "no reason recorded"}
                                </span>
                            </div>
                        )}

                        {/* Account */}
                        <section className="users-directory__section">
                            <h3 className="users-directory__section-title">Account</h3>
                            <dl className="users-directory__facts">
                                <div><dt>Email</dt><dd>{detail.email}</dd></div>
                                <div><dt>Username</dt><dd>@{detail.username}</dd></div>
                                <div><dt>Email verified</dt><dd>{detail.emailVerified ? fmtDate(detail.emailVerified) : "No"}</dd></div>
                                <div><dt>Role</dt><dd>{detail.role}</dd></div>
                                <div><dt>Location</dt><dd>{[detail.city, detail.country].filter(Boolean).join(", ") || "—"}</dd></div>
                                <div><dt>Joined</dt><dd>{fmtDate(detail.createdAt)}</dd></div>
                                <div><dt>Following</dt><dd>{detail._count.follows}</dd></div>
                                <div><dt>Subscriptions</dt><dd>{detail._count.subscriptions}</dd></div>
                                <div><dt>Gifts sent</dt><dd>{detail._count.giftsSent}</dd></div>
                            </dl>
                        </section>

                        {/* Fan wallet */}
                        {detail.wallet && (
                            <section className="users-directory__section">
                                <h3 className="users-directory__section-title">
                                    Fan wallet · {naira(detail.wallet.balance)}
                                </h3>
                                <TxList transactions={detail.wallet.transactions} />
                            </section>
                        )}

                        {/* Creator profile + wallet */}
                        {detail.creator && (
                            <>
                                <section className="users-directory__section">
                                    <h3 className="users-directory__section-title">Creator profile</h3>
                                    <dl className="users-directory__facts">
                                        <div><dt>Display name</dt><dd>{detail.creator.displayName}</dd></div>
                                        <div><dt>Handle</dt><dd>@{detail.creator.handle ?? "—"}</dd></div>
                                        <div><dt>Verification</dt><dd>{detail.creator.verificationStatus}{detail.creator.isVerified ? " ✓" : ""}</dd></div>
                                        <div><dt>Trust score</dt><dd>{detail.creator.trustScore}</dd></div>
                                        <div><dt>Followers</dt><dd>{detail.creator.followersCount.toLocaleString()}</dd></div>
                                        <div><dt>Subscribers</dt><dd>{detail.creator.subscribersCount.toLocaleString()}</dd></div>
                                        <div><dt>Posts</dt><dd>{detail.creator._count.posts}</dd></div>
                                        <div><dt>Streams</dt><dd>{detail.creator._count.streams}</dd></div>
                                        <div><dt>Withdrawals</dt><dd>{detail.creator._count.withdrawals}</dd></div>
                                    </dl>
                                </section>

                                {detail.creator.wallet && (
                                    <section className="users-directory__section">
                                        <h3 className="users-directory__section-title">
                                            Creator wallet · {naira(detail.creator.wallet.balance)}
                                        </h3>
                                        <TxList transactions={detail.creator.wallet.transactions} />
                                    </section>
                                )}
                            </>
                        )}

                        {/* Suspension actions */}
                        {detail.role !== "ADMIN" && (
                            <div className="users-directory__panel-actions">
                                {detail.isSuspended ? (
                                    <button
                                        type="button"
                                        className="users-directory__btn users-directory__btn--primary"
                                        disabled={isPending}
                                        onClick={handleUnsuspend}
                                    >
                                        {isPending ? <Loader2 size={15} className="users-directory__spinner" /> : <RotateCcw size={15} />}
                                        Lift suspension
                                    </button>
                                ) : !suspendOpen ? (
                                    <button
                                        type="button"
                                        className="users-directory__btn users-directory__btn--danger"
                                        onClick={() => setSuspendOpen(true)}
                                    >
                                        <Ban size={15} /> Suspend account
                                    </button>
                                ) : (
                                    <div className="users-directory__suspend-form">
                                        <textarea
                                            className="users-directory__suspend-input"
                                            placeholder="Reason (shown to the user)…"
                                            value={suspendReason}
                                            onChange={(e) => setReason(e.target.value)}
                                            rows={3}
                                        />
                                        <div className="users-directory__panel-actions">
                                            <button
                                                type="button"
                                                className="users-directory__btn"
                                                onClick={() => { setSuspendOpen(false); setReason("") }}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                className="users-directory__btn users-directory__btn--danger"
                                                disabled={suspendReason.trim().length < 5 || isPending}
                                                onClick={handleSuspend}
                                            >
                                                {isPending ? <Loader2 size={15} className="users-directory__spinner" /> : <Ban size={15} />}
                                                Confirm suspension
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

function TxList({ transactions }: { transactions: WalletTx[] }) {
    if (transactions.length === 0) {
        return <p className="users-directory__tx-empty">No transactions.</p>
    }
    return (
        <ul className="users-directory__tx-list">
            {transactions.map((tx) => (
                <li key={tx.id} className="users-directory__tx">
                    <div className="users-directory__tx-info">
                        <span className="users-directory__tx-type">{tx.type.replaceAll("_", " ")}</span>
                        {tx.description && (
                            <span className="users-directory__tx-desc">{tx.description}</span>
                        )}
                    </div>
                    <div className="users-directory__tx-right">
                        <span className="users-directory__tx-amount">{naira(tx.amount)}</span>
                        <span className="users-directory__tx-date">{fmtDate(tx.createdAt)}</span>
                    </div>
                </li>
            ))}
        </ul>
    )
}