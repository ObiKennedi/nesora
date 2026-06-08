"use client"

import { Loader } from "@/component/essentials/Loader"
import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import "@/styles/auth/AuthLayout.scss"

const slides = [
    {
        src: "/auth/auth-1.jpg",
        caption: "Built for creators who want more than just views.",
    },
    {
        src: "/auth/auth-2.jpg",
        caption: "Turn your passion into a sustainable career.",
    },
    {
        src: "/auth/auth-3.jpg",
        caption: "Connect directly with the people who believe in you.",
    },
    {
        src: "/auth/auth-4.jpg",
        caption: "Create. Connect. Earn.",
    },
]

const AuthLayout = ({ children }: { children: React.ReactNode }) => {

    const [current, setCurrent] = useState(0)
    const [fading, setFading] = useState(false)

    useEffect(() => {
        const interval = setInterval(() => {
            setFading(true)
            setTimeout(() => {
                setCurrent((prev) => (prev + 1) % slides.length)
                setFading(false)
            }, 600)
        }, 60_000) // every minute

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="auth-page">

            {/* ── Left: Image Panel ── */}
            <div className="auth-panel">

                {/* Logo */}
                <Link href="/" className="auth-panel__logo">
                    <img
                        src="/logo.png"
                        alt="NESORA"
                    />
                </Link>

                {/* Slides */}
                {slides.map((slide, i) => (
                    <div
                        key={slide.src}
                        className={`auth-panel__slide ${i === current
                            ? fading
                                ? "auth-panel__slide--fading"
                                : "auth-panel__slide--active"
                            : ""
                            }`}
                        aria-hidden={i !== current}
                    >
                        <img
                            src={slide.src}
                            alt={slide.caption}
                            className="auth-panel__img"
                        />
                    </div>
                ))}

                {/* Overlay */}
                <div className="auth-panel__overlay" aria-hidden="true" />

                {/* Caption */}
                <div className={`auth-panel__caption ${fading ? "auth-panel__caption--fading" : ""}`}>
                    <p>{slides[current].caption}</p>
                </div>

                {/* Dots */}
                <div className="auth-panel__dots" role="tablist" aria-label="Image slides">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            role="tab"
                            aria-selected={i === current}
                            aria-label={`Slide ${i + 1}`}
                            className={`auth-panel__dot ${i === current ? "auth-panel__dot--active" : ""}`}
                            onClick={() => {
                                setFading(true)
                                setTimeout(() => {
                                    setCurrent(i)
                                    setFading(false)
                                }, 600)
                            }}
                        />
                    ))}
                </div>

            </div>

            {/* ── Right: Form ── */}
            <div className="auth-form-panel">
                <Suspense fallback={<Loader fullscreen={false} message="Loading…" />}>
                    {children}
                </Suspense>
            </div>

        </div>
    )
}

export default AuthLayout