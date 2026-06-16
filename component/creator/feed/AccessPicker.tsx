// components/creator/feed/AccessPicker.tsx
"use client"

import { useEffect, useState, useTransition } from "react"
import {
    Globe, Users, Star, Lock,
    Crown, ChevronDown, CheckCircle,
} from "lucide-react"
import { PostAccessLevel }            from "@prisma/client"
import { getSubscriptionPlansAction } from "@/actions/creator/subscription-plans"
import "@/styles/creator/feed/AccessPicker.scss"

type Plan = {
    id:       string
    name:     string
    price:    any
    isActive: boolean
}

type AccessValue = {
    accessLevel:    PostAccessLevel
    allowedPlanIds: string[]
}

type Props = {
    value:     AccessValue
    onChange:  (val: AccessValue) => void
    disabled?: boolean
}

const ACCESS_OPTIONS = [
    {
        level:       "PUBLIC"           as PostAccessLevel,
        label:       "Public",
        description: "Visible to everyone",
        icon:        <Globe   size={16} />,
        color:       "green",
    },
    {
        level:       "FOLLOWERS_ONLY"   as PostAccessLevel,
        label:       "Followers Only",
        description: "Must follow you to see this",
        icon:        <Users   size={16} />,
        color:       "blue",
    },
    {
        level:       "SUBSCRIBERS_ONLY" as PostAccessLevel,
        label:       "All Subscribers",
        description: "Any active subscription",
        icon:        <Star    size={16} />,
        color:       "amber",
    },
    {
        level:       "PLAN_SPECIFIC"    as PostAccessLevel,
        label:       "Specific Plans",
        description: "Select which plans can access",
        icon:        <Lock    size={16} />,
        color:       "purple",
    },
    {
        level:       "TOP_FANS_ONLY"    as PostAccessLevel,
        label:       "Top Fans Only",
        description: "Your most engaged supporters",
        icon:        <Crown   size={16} />,
        color:       "primary",
    },
]

export const AccessPicker = ({ value, onChange, disabled }: Props) => {

    const [open,     setOpen]     = useState(false)
    const [plans,    setPlans]    = useState<Plan[]>([])
    const [isPending, startTransition] = useTransition()

    const selected = ACCESS_OPTIONS.find((o) => o.level === value.accessLevel)
        ?? ACCESS_OPTIONS[0]

    // Fetch plans when PLAN_SPECIFIC is selected
    useEffect(() => {
        if (value.accessLevel === "PLAN_SPECIFIC" && plans.length === 0) {
            startTransition(async () => {
                const res = await getSubscriptionPlansAction()
                setPlans(res.filter((p) => p.isActive))
            })
        }
    }, [value.accessLevel])

    const handleSelect = (level: PostAccessLevel) => {
        onChange({
            accessLevel:    level,
            allowedPlanIds: level === "PLAN_SPECIFIC" ? value.allowedPlanIds : [],
        })
        if (level !== "PLAN_SPECIFIC") setOpen(false)
    }

    const togglePlan = (planId: string) => {
        const current = value.allowedPlanIds
        const updated = current.includes(planId)
            ? current.filter((id) => id !== planId)
            : [...current, planId]
        onChange({ ...value, allowedPlanIds: updated })
    }

    const fmtMoney = (n: number) =>
        new Intl.NumberFormat("en-NG", {
            style: "currency", currency: "NGN", maximumFractionDigits: 0,
        }).format(n)

    return (
        <div className="access-picker">
            <label className="access-picker__label">
                <Lock size={13} />
                Who can see this?
            </label>

            {/* ── Trigger ── */}
            <button
                type="button"
                className={`access-trigger access-trigger--${selected.color}`}
                onClick={() => setOpen((v) => !v)}
                disabled={disabled}
            >
                <span className="access-trigger__icon">{selected.icon}</span>
                <span className="access-trigger__label">{selected.label}</span>
                <ChevronDown
                    size={14}
                    className={`access-trigger__chevron ${open ? "access-trigger__chevron--open" : ""}`}
                />
            </button>

            {/* ── Dropdown ── */}
            {open && (
                <div className="access-dropdown">
                    {ACCESS_OPTIONS.map((opt) => (
                        <button
                            key={opt.level}
                            type="button"
                            className={`access-option ${value.accessLevel === opt.level ? "access-option--selected" : ""}`}
                            onClick={() => handleSelect(opt.level)}
                        >
                            <span className={`access-option__icon access-option__icon--${opt.color}`}>
                                {opt.icon}
                            </span>
                            <div className="access-option__text">
                                <span className="access-option__name">{opt.label}</span>
                                <span className="access-option__desc">{opt.description}</span>
                            </div>
                            {value.accessLevel === opt.level && (
                                <CheckCircle size={14} className="access-option__check" />
                            )}
                        </button>
                    ))}

                    {/* ── Plan selector ── */}
                    {value.accessLevel === "PLAN_SPECIFIC" && (
                        <div className="access-plans">
                            <p className="access-plans__heading">
                                Select plans that can access this post:
                            </p>
                            {isPending ? (
                                <p className="access-plans__loading">Loading plans…</p>
                            ) : plans.length === 0 ? (
                                <p className="access-plans__empty">
                                    No active plans found. Create subscription plans first.
                                </p>
                            ) : (
                                plans.map((plan) => {
                                    const isSelected = value.allowedPlanIds.includes(plan.id)
                                    return (
                                        <button
                                            key={plan.id}
                                            type="button"
                                            className={`access-plan-opt ${isSelected ? "access-plan-opt--selected" : ""}`}
                                            onClick={() => togglePlan(plan.id)}
                                        >
                                            <div className={`access-plan-opt__check ${isSelected ? "access-plan-opt__check--active" : ""}`}>
                                                {isSelected && <CheckCircle size={12} />}
                                            </div>
                                            <span className="access-plan-opt__name">{plan.name}</span>
                                            <span className="access-plan-opt__price">
                                                {fmtMoney(Number(plan.price))}/mo
                                            </span>
                                        </button>
                                    )
                                })
                            )}

                            {value.allowedPlanIds.length > 0 && (
                                <button
                                    type="button"
                                    className="access-plans__done"
                                    onClick={() => setOpen(false)}
                                >
                                    Done — {value.allowedPlanIds.length} plan{value.allowedPlanIds.length !== 1 ? "s" : ""} selected
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Summary tag when closed ── */}
            {!open && value.accessLevel === "PLAN_SPECIFIC" && value.allowedPlanIds.length > 0 && (
                <p className="access-picker__plan-summary">
                    {value.allowedPlanIds.length} plan{value.allowedPlanIds.length !== 1 ? "s" : ""} selected
                </p>
            )}
        </div>
    )
}