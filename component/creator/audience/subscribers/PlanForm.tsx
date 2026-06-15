// components/creator/audience/subscribers/PlanForm.tsx
"use client"

import { useState, useTransition } from "react"
import {
    Plus, Trash2, Loader2,
    CheckCircle, X,
} from "lucide-react"
import {
    createSubscriptionPlanAction,
    updateSubscriptionPlanAction,
} from "@/actions/creator/subscription-plans"
import "@/styles/creator/audience/PlanForm.scss"

type Plan = {
    id: string
    name: string
    description: string | null
    price: any
    interval: string
    benefits: string[]
    isActive: boolean
}

type Props = {
    plan?: Plan       // if provided = edit mode
    onSuccess: () => void
    onCancel: () => void
}

export const PlanForm = ({ plan, onSuccess, onCancel }: Props) => {

    const isEdit = !!plan

    const [name, setName] = useState(plan?.name ?? "")
    const [description, setDescription] = useState(plan?.description ?? "")
    const [price, setPrice] = useState(plan?.price ? Number(plan.price) : 0)
    const [interval, setInterval] = useState<"monthly" | "yearly">(
        (plan?.interval as "monthly" | "yearly") ?? "monthly"
    )
    const [benefits, setBenefits] = useState<string[]>(plan?.benefits ?? [""])
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const addBenefit = () => {
        if (benefits.length >= 10) return
        setBenefits((b) => [...b, ""])
    }

    const removeBenefit = (i: number) => {
        if (benefits.length <= 1) return
        setBenefits((b) => b.filter((_, idx) => idx !== i))
    }

    const updateBenefit = (i: number, val: string) => {
        setBenefits((b) => b.map((v, idx) => idx === i ? val : v))
    }

    const handleSubmit = () => {
        setError(null)
        const cleanBenefits = benefits.filter((b) => b.trim())

        startTransition(async () => {
            const data = { name, description, price, interval, benefits: cleanBenefits }

            const res = isEdit
                ? await updateSubscriptionPlanAction(plan.id, data)
                : await createSubscriptionPlanAction(data)

            if (res?.error) setError(res.error)
            else onSuccess()
        })
    }

    return (
        <div className="plan-form">
            <div className="plan-form__header">
                <h3>{isEdit ? "Edit Plan" : "Create Plan"}</h3>
                <button
                    className="plan-form__close"
                    onClick={onCancel}
                    aria-label="Close"
                >
                    <X size={16} />
                </button>
            </div>

            <div className="plan-form__body">

                {/* Name */}
                <div className="plan-form__field">
                    <label>Plan Name</label>
                    <input
                        type="text"
                        placeholder="e.g. Basic, Premium, VIP"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isPending}
                        maxLength={50}
                    />
                </div>

                {/* Description */}
                <div className="plan-form__field">
                    <label>
                        Description
                        <span className="plan-form__optional"> — optional</span>
                    </label>
                    <textarea
                        placeholder="What do subscribers get?"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isPending}
                        rows={2}
                        maxLength={200}
                    />
                </div>

                {/* Price + interval */}
                <div className="plan-form__row">
                    <div className="plan-form__field">
                        <label>Price (₦)</label>
                        <div className="plan-form__price-wrap">
                            <span className="plan-form__currency">₦</span>
                            <input
                                type="number"
                                placeholder="0"
                                value={price || ""}
                                onChange={(e) => setPrice(Number(e.target.value))}
                                disabled={isPending}
                                min={100}
                            />
                        </div>
                    </div>
                    <div className="plan-form__field">
                        <label>Billing</label>
                        <select
                            value={interval}
                            onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")}
                            disabled={isPending}
                        >
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                    </div>
                </div>

                {/* Benefits */}
                <div className="plan-form__field">
                    <label>Benefits</label>
                    <div className="plan-form__benefits">
                        {benefits.map((benefit, i) => (
                            <div key={i} className="plan-form__benefit-row">
                                <span className="plan-form__benefit-check">
                                    <CheckCircle size={14} />
                                </span>
                                <input
                                    type="text"
                                    placeholder={`Benefit ${i + 1}`}
                                    value={benefit}
                                    onChange={(e) => updateBenefit(i, e.target.value)}
                                    disabled={isPending}
                                    maxLength={80}
                                />
                                {benefits.length > 1 && (
                                    <button
                                        type="button"
                                        className="plan-form__benefit-remove"
                                        onClick={() => removeBenefit(i)}
                                        disabled={isPending}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        ))}

                        {benefits.length < 10 && (
                            <button
                                type="button"
                                className="plan-form__add-benefit"
                                onClick={addBenefit}
                                disabled={isPending}
                            >
                                <Plus size={13} />
                                Add benefit
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <p className="plan-form__error">{error}</p>
                )}
            </div>

            <div className="plan-form__footer">
                <button
                    className="plan-form__btn plan-form__btn--cancel"
                    onClick={onCancel}
                    disabled={isPending}
                >
                    Cancel
                </button>
                <button
                    className="plan-form__btn plan-form__btn--submit"
                    onClick={handleSubmit}
                    disabled={isPending}
                >
                    {isPending
                        ? <><Loader2 size={14} className="spin" /> Saving…</>
                        : isEdit ? "Save Changes" : "Create Plan"
                    }
                </button>
            </div>
        </div>
    )
}