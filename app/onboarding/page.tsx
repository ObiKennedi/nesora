// app/onboarding/page.tsx
"use client"

import { useTransition } from "react"
import { selectOnboardingAction } from "@/actions/auth/select-onboarding"
import { Loader2, Mic2, Star } from "lucide-react"
import { useState } from "react"
import "@/styles/onboarding/SelectOnboarding.scss"

const options = [
    {
        type: "FAN" as const,
        icon: <Star size={28} />,
        label: "I'm a Fan",
        description: "Discover creators, subscribe to exclusive content, send gifts, and be part of communities you love.",
        perks: [
            "Follow your favourite creators",
            "Access exclusive subscriber content",
            "Send gifts and show support",
            "Join creator communities",
        ],
    },
    {
        type: "CREATOR" as const,
        icon: <Mic2 size={28} />,
        label: "I'm a Creator",
        description: "Build your community, monetize your content, go live, and connect directly with your biggest supporters.",
        perks: [
            "Earn through subscriptions & gifts",
            "Host live video streams",
            "Private chats with subscribers",
            "Creator analytics dashboard",
        ],
    },
]

export default function SelectOnboardingPage() {

    const [selected, setSelected] = useState<"FAN" | "CREATOR" | null>(null)
    const [isPending, startTransition] = useTransition()

    const handleContinue = () => {
        if (!selected) return
        startTransition(async () => {
            await selectOnboardingAction(selected)
        })
    }

    return (
        <div className="select-onboarding">

            <div className="select-onboarding__header">
                <span className="select-onboarding__eyebrow">Welcome to NESORA</span>
                <h1>How will you use NESORA?</h1>
                <p>Choose your account type. You can always change this later.</p>
            </div>

            <div className="select-onboarding__cards">
                {options.map((opt) => (
                    <button
                        key={opt.type}
                        type="button"
                        className={`onboarding-card ${selected === opt.type ? "onboarding-card--selected" : ""}`}
                        onClick={() => setSelected(opt.type)}
                        disabled={isPending}
                    >
                        {/* Selected tick */}
                        <div className="onboarding-card__tick">
                            <svg viewBox="0 0 16 16" fill="none">
                                <circle cx="8" cy="8" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>

                        <div className="onboarding-card__icon">{opt.icon}</div>
                        <h3 className="onboarding-card__label">{opt.label}</h3>
                        <p className="onboarding-card__desc">{opt.description}</p>

                        <ul className="onboarding-card__perks">
                            {opt.perks.map((perk) => (
                                <li key={perk}>
                                    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {perk}
                                </li>
                            ))}
                        </ul>
                    </button>
                ))}
            </div>

            <div className="select-onboarding__action">
                <button
                    className="onboarding-submit"
                    onClick={handleContinue}
                    disabled={!selected || isPending}
                >
                    {isPending
                        ? <><Loader2 size={16} className="spin" /> Setting up your account…</>
                        : "Continue"
                    }
                </button>
                {!selected && (
                    <p className="select-onboarding__hint">
                        Select an account type to continue
                    </p>
                )}
            </div>

        </div>
    )
}