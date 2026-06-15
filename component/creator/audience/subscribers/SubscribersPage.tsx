// components/creator/audience/subscribers/SubscribersPage.tsx
"use client"

import { useState, useEffect, useTransition, useCallback } from "react"
import {
    UserCheck, Search, Loader2,
    TrendingUp, DollarSign, Users,
    BadgeDollarSign, Plus,
} from "lucide-react"
import { getSubscribersAction } from "@/actions/creator/audience"
import { getSubscriptionPlansAction } from "@/actions/creator/subscription-plans"
import { SubscriberCard } from "./SubscriberCard"
import { PlanCard } from "./PlanCard"
import { PlanForm } from "./PlanForm"

import "@/styles/creator/audience/SubscribersPage.scss"
import "@/styles/creator/audience/PlanCard.scss"
import "@/styles/creator/audience/PlanForm.scss"
import "@/styles/creator/audience/SubscriberCard.scss"

type Subscription = Awaited<ReturnType<typeof getSubscribersAction>>["subscriptions"][0]
type Stats = Awaited<ReturnType<typeof getSubscribersAction>>["stats"]

const STATUS_FILTERS = [
    { value: "ALL", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "EXPIRED", label: "Expired" },
    { value: "CANCELLED", label: "Cancelled" },
] as const

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(n)

export const SubscribersPage = () => {

    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [stats, setStats] = useState<Stats | null>(null)
    const [total, setTotal] = useState(0)
    const [pages, setPages] = useState(1)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState("")
    const [query, setQuery] = useState("")
    const [status, setStatus] = useState<"ALL" | "ACTIVE" | "EXPIRED" | "CANCELLED">("ALL")
    const [isPending, startTransition] = useTransition()

    const [plans, setPlans] = useState<any[]>([])
    const [showPlanForm, setShowPlanForm] = useState(false)
    const [editingPlan, setEditingPlan] = useState<any | null>(null)
    const [plansPending, startPlansTransition] = useTransition()

    const fetchSubscribers = useCallback(() => {
        startTransition(async () => {
            const res = await getSubscribersAction({
                search: query || undefined,
                status,
                page,
                limit: 20,
            })
            setSubscriptions(res.subscriptions)
            setStats(res.stats)
            setTotal(res.total)
            setPages(res.pages)
        })
    }, [query, status, page])

    const fetchPlans = useCallback(() => {
        startPlansTransition(async () => {
            const res = await getSubscriptionPlansAction()
            setPlans(res)
        })
    }, [])

    useEffect(() => { fetchSubscribers() }, [fetchSubscribers])
    useEffect(() => { fetchPlans() }, [fetchPlans])

    useEffect(() => {
        const t = setTimeout(() => { setQuery(search); setPage(1) }, 400)
        return () => clearTimeout(t)
    }, [search])

    return (
        <div className="subscribers-page">

            {/* ── Stats row ── */}
            {stats && (
                <div className="subscribers-stats">
                    <div className="sub-stat">
                        <div className="sub-stat__icon sub-stat__icon--green">
                            <Users size={18} />
                        </div>
                        <div>
                            <p className="sub-stat__value">{stats.activeCount.toLocaleString()}</p>
                            <p className="sub-stat__label">Active Subscribers</p>
                        </div>
                    </div>
                    <div className="sub-stat">
                        <div className="sub-stat__icon sub-stat__icon--blue">
                            <DollarSign size={18} />
                        </div>
                        <div>
                            <p className="sub-stat__value">{fmtMoney(stats.monthRevenue)}</p>
                            <p className="sub-stat__label">This Month</p>
                        </div>
                    </div>
                    <div className="sub-stat">
                        <div className="sub-stat__icon sub-stat__icon--primary">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <p className="sub-stat__value">{fmtMoney(stats.totalRevenue)}</p>
                            <p className="sub-stat__label">All Time Revenue</p>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header ── */}
            <div className="subscribers-page__header">
                <div className="subscribers-page__title">
                    <UserCheck size={20} />
                    <div>
                        <h2>Subscribers</h2>
                        <p>
                            {total === 0
                                ? "No subscribers yet"
                                : `${total.toLocaleString()} subscriber${total !== 1 ? "s" : ""}`
                            }
                        </p>
                    </div>
                </div>

                <div className="subscribers-page__controls">
                    {/* Status filter */}
                    <div className="sub-filter-group">
                        {STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                className={`sub-filter-btn ${status === f.value ? "sub-filter-btn--active" : ""}`}
                                onClick={() => { setStatus(f.value); setPage(1) }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="subscribers-page__search">
                        <Search size={15} />
                        <input
                            type="text"
                            placeholder="Search subscribers…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            {isPending ? (
                <div className="subscribers-page__loading">
                    <Loader2 size={24} className="spin" />
                </div>
            ) : subscriptions.length === 0 ? (
                <div className="subscribers-page__empty">
                    <UserCheck size={32} />
                    <h3>
                        {query
                            ? `No subscribers matching "${query}"`
                            : status !== "ALL"
                                ? `No ${status.toLowerCase()} subscribers`
                                : "No subscribers yet"
                        }
                    </h3>
                    <p>
                        {!query && status === "ALL"
                            ? "Enable subscriptions from your profile settings to start earning."
                            : "Try a different filter or search term."
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="subscribers-page__list">
                        {subscriptions.map((sub) => (
                            <SubscriberCard key={sub.id} subscription={sub} />
                        ))}
                    </div>

                    {pages > 1 && (
                        <div className="subscribers-page__pagination">
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p - 1)}
                                disabled={page === 1 || isPending}
                            >
                                Previous
                            </button>
                            <span className="page-indicator">
                                Page {page} of {pages}
                            </span>
                            <button
                                className="page-btn"
                                onClick={() => setPage((p) => p + 1)}
                                disabled={page === pages || isPending}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ── Subscription Plans ── */}
            <div className="subscription-plans">
                <div className="subscription-plans__header">
                    <div className="subscription-plans__title">
                        <BadgeDollarSign size={18} />
                        <h3>Subscription Plans</h3>
                        <span className="subscription-plans__count">
                            {plans.length}/3 plans
                        </span>
                    </div>
                    {plans.length < 3 && (
                        <button
                            className="sub-plan-btn"
                            onClick={() => {
                                setEditingPlan(null)
                                setShowPlanForm(true)
                            }}
                        >
                            <Plus size={15} />
                            New Plan
                        </button>
                    )}
                </div>

                {/* Plan form */}
                {showPlanForm && (
                    <PlanForm
                        plan={editingPlan ?? undefined}
                        onSuccess={() => {
                            setShowPlanForm(false)
                            setEditingPlan(null)
                            fetchPlans()
                        }}
                        onCancel={() => {
                            setShowPlanForm(false)
                            setEditingPlan(null)
                        }}
                    />
                )}

                {plansPending ? (
                    <div className="subscription-plans__loading">
                        <Loader2 size={20} className="spin" />
                    </div>
                ) : plans.length === 0 ? (
                    <div className="subscription-plans__empty">
                        <BadgeDollarSign size={28} />
                        <p>No subscription plans yet</p>
                        <span>Create up to 3 plans to start earning from subscribers.</span>
                        <button
                            className="sub-plan-btn"
                            onClick={() => setShowPlanForm(true)}
                        >
                            <Plus size={15} />
                            Create your first plan
                        </button>
                    </div>
                ) : (
                    <div className="subscription-plans__grid">
                        {plans.map((plan) => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                onEdit={(p) => {
                                    setEditingPlan(p)
                                    setShowPlanForm(true)
                                }}
                                onDeleted={(id) => setPlans((p) => p.filter((pl) => pl.id !== id))}
                                onToggled={(id, isActive) =>
                                    setPlans((p) =>
                                        p.map((pl) => pl.id === id ? { ...pl, isActive } : pl)
                                    )
                                }
                            />
                        ))}
                    </div>
                )}
            </div>

        </div>
    )
}