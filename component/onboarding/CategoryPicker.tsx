// components/onboarding/CategoryPicker.tsx
"use client"

import { useState, useTransition } from "react"
import { Category } from "@prisma/client"
import { Loader2 } from "lucide-react"
import "@/styles/onboarding/CategoryPicker.scss"
import { CATEGORIES } from "@/lib/categories"

type Props = {
    heading: string
    subHeading: string
    hint: string
    min?: number
    max?: number
    onSubmit: (categories: Category[]) => Promise<{ error?: string } | void>
    submitLabel: string
}

export const CategoryPicker = ({
    heading,
    subHeading,
    hint,
    min = 1,
    max = 10,
    onSubmit,
    submitLabel,
}: Props) => {

    const [selected, setSelected] = useState<Category[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const toggle = (cat: Category) => {
        setError(null)
        setSelected((prev) => {
            if (prev.includes(cat)) {
                return prev.filter((c) => c !== cat)
            }
            if (prev.length >= max) {
                setError(`You can pick a maximum of ${max} categories`)
                return prev
            }
            return [...prev, cat]
        })
    }

    const handleSubmit = () => {
        if (selected.length < min) {
            setError(`Please pick at least ${min} categor${min === 1 ? "y" : "ies"}`)
            return
        }

        startTransition(async () => {
            const res = await onSubmit(selected)
            if (res?.error) setError(res.error)
        })
    }

    return (
        <div className="category-picker">

            {/* Header */}
            <div className="category-picker__header">
                <span className="category-picker__eyebrow">
                    {selected.length}/{max} selected
                </span>
                <h1>{heading}</h1>
                <p>{subHeading}</p>
            </div>

            {/* Grid */}
            <div className="category-picker__grid">
                {CATEGORIES.map((cat) => {
                    const isSelected = selected.includes(cat.value)
                    const isDisabled = !isSelected && selected.length >= max

                    return (
                        <button
                            key={cat.value}
                            type="button"
                            className={`category-tile ${isSelected ? "category-tile--selected" : ""} ${isDisabled ? "category-tile--disabled" : ""}`}
                            onClick={() => toggle(cat.value)}
                            disabled={isPending}
                            aria-pressed={isSelected}
                        >
                            <span className="category-tile__emoji">{cat.emoji}</span>
                            <span className="category-tile__label">{cat.label}</span>
                            {isSelected && (
                                <span className="category-tile__check" aria-hidden="true">✓</span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Hint + error */}
            <div className="category-picker__footer">
                {error ? (
                    <p className="category-picker__error">{error}</p>
                ) : (
                    <p className="category-picker__hint">{hint}</p>
                )}

                <button
                    className="onboarding-submit"
                    onClick={handleSubmit}
                    disabled={isPending || selected.length < min}
                >
                    {isPending
                        ? <><Loader2 size={16} className="spin" /> Saving…</>
                        : submitLabel
                    }
                </button>
            </div>

        </div>
    )
}