// components/creator/audience/subscribers/PlanCard.tsx
"use client"

import { useState, useTransition } from "react"
import {
    CheckCircle, Edit2, Trash2,
    Loader2, ToggleLeft, ToggleRight,
    Users,
} from "lucide-react"
import {
    togglePlanStatusAction,
    deletePlanAction,
} from "@/actions/creator/subscription-plans"
import "@/styles/creator/audience/PlanCard.scss"

type Plan = {
    id: string
    name: string
    description: string | null
    price: any
    interval: string
    benefits: string[]
    isActive: boolean
    _count: { subscriptions: number }
}

type Props = {
    plan: Plan
    onEdit: (plan: Plan) => void
    onDeleted: (id: string) => void
    onToggled: (id: string, isActive: boolean) => void
}

const fmtMoney = (n: number) =>
    new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
    }).format(n)

const tierColors = ["primary", "blue", "purple"]

export const PlanCard = ({ plan, onEdit, onDeleted, onToggled }: Props) => {

    const [isPending, startTransition] = useTransition()
    const [deleteError, setDeleteError] = useState<string | null>(null)

    const colorIndex = 0 // caller can pass index for color variety

    const handleToggle = () => {
        startTransition(async () => {
            const res = await togglePlanStatusAction(plan.id)
            if (res?.success) onToggled(plan.id, res.isActive!)
        })
    }

    const handleDelete = () => {
        if (!confirm(`Delete "${plan.name}"?`)) return
        setDeleteError(null)
        startTransition(async () => {
            const res = await deletePlanAction(plan.id)
            if (res?.error) setDeleteError(res.error)
            else onDeleted(plan.id)
        })
    }

    return (
        <div className={`plan-card ${!plan.isActive ? "plan-card--inactive" : ""}`}>

            {/* ── Header ── */}
            <div className="plan-card__header">
                <div className="plan-card__name-wrap">
                    <h3 className="plan-card__name">{plan.name}</h3>
                    {!plan.isActive && (
                        <span className="plan-card__inactive-badge">Inactive</span>
                    )}
                </div>
                <div className="plan-card__actions">
                    <button
                        className="plan-card__icon-btn"
                        onClick={handleToggle}
                        disabled={isPending}
                        title={plan.isActive ? "Deactivate" : "Activate"}
                    >
                        {isPending
                            ? <Loader2 size={16} className="spin" />
                            : plan.isActive
                                ? <ToggleRight size={20} className="toggle--on" />
                                : <ToggleLeft size={20} className="toggle--off" />
                        }
                    </button>
                    <button
                        className="plan-card__icon-btn"
                        onClick={() => onEdit(plan)}
                        disabled={isPending}
                        title="Edit plan"
                    >
                        <Edit2 size={15} />
                    </button>
                    <button
                        className="plan-card__icon-btn plan-card__icon-btn--delete"
                        onClick={handleDelete}
                        disabled={isPending}
                        title="Delete plan"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* ── Price ── */}
            <div className="plan-card__price">
                <span className="plan-card__amount">
                    {fmtMoney(Number(plan.price))}
                </span>
                <span className="plan-card__interval">
                    / {plan.interval}
                </span>
            </div>

            {/* ── Description ── */}
            {plan.description && (
                <p className="plan-card__description">{plan.description}</p>
            )}

            {/* ── Benefits ── */}
            <ul className="plan-card__benefits">
                {plan.benefits.map((b, i) => (
                    <li key={i}>
                        <CheckCircle size={13} />
                        {b}
                    </li>
                ))}
            </ul>

            {/* ── Subscriber count ── */}
            <div className="plan-card__footer">
                <span className="plan-card__subs">
                    <Users size={13} />
                    {plan._count.subscriptions} active subscriber{plan._count.subscriptions !== 1 ? "s" : ""}
                </span>
            </div>

            {deleteError && (
                <p className="plan-card__error">{deleteError}</p>
            )}
        </div>
    )
}