// components/essentials/Loader.tsx
"use client"

import "@/styles/essentials/Loader.scss"

interface LoaderProps {
    message?: string
    fullscreen?: boolean
}

export const Loader = ({
    message = "Loading…",
    fullscreen = true,
}: LoaderProps) => {
    return (
        <div className={`nsr-loader ${fullscreen ? "nsr-loader--fullscreen" : "nsr-loader--inline"}`}
            role="status"
            aria-live="polite"
            aria-label="Loading"
        >
            {fullscreen && (
                <>
                    <div className="nsr-loader__grain" aria-hidden="true" />
                    <div className="nsr-loader__bloom" aria-hidden="true" />
                    {["tl", "tr", "bl", "br"].map((pos) => (
                        <div key={pos} className={`nsr-loader__corner nsr-loader__corner--${pos}`} aria-hidden="true" />
                    ))}
                </>
            )}

            <div className="nsr-loader__center">

                {/* Emblem */}
                <div className="nsr-loader__emblem" aria-hidden="true">
                    <div className="nsr-loader__ring">
                        <svg viewBox="0 0 100 100" fill="none">
                            <circle
                                cx="50" cy="50" r="46"
                                stroke="url(#ring-grad)"
                                strokeWidth="0.8"
                                strokeDasharray="3 7"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="ring-grad" x1="4" y1="50" x2="96" y2="50" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#c2622a" stopOpacity="0" />
                                    <stop offset="0.5" stopColor="#c2622a" stopOpacity="0.9" />
                                    <stop offset="1" stopColor="#c2622a" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>

                    <div className="nsr-loader__ring nsr-loader__ring--inner">
                        <svg viewBox="0 0 100 100" fill="none">
                            <circle
                                cx="50" cy="50" r="34"
                                stroke="rgba(194,98,42,0.25)"
                                strokeWidth="0.6"
                                strokeDasharray="2 8"
                                strokeLinecap="round"
                            />
                        </svg>
                    </div>

                    <div className="nsr-loader__pulse" />

                    <div className="nsr-loader__logo-wrap">
                        <img src="/logo-light.png" alt="NESORA" className="nsr-loader__logo" />
                        <div className="nsr-loader__glow" />
                    </div>
                </div>

                {/* Message */}
                <p className="nsr-loader__message">{message}</p>

            </div>

            {fullscreen && (
                <p className="nsr-loader__tagline" aria-hidden="true">
                    Create. Connect. Earn.
                </p>
            )}
        </div>
    )
}