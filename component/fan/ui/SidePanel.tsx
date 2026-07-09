// components/fan/ui/SidePanel.tsx
"use client"

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from "react"
import { X } from "lucide-react"
import "@/styles/fan/SidePanel.scss"

/**
 * A single surface that renders as:
 *   ≥1024px → right-edge slide-in drawer (Instagram web style)
 *   <1024px → bottom sheet (identical to the old modal behaviour)
 *
 * Content lays out its own scroll region and footer using
 * `.side-panel__scroll` and `.side-panel__footer`.
 */

// ── Animated-close context ────────────────────────────────────────────────────

const EXIT_MS = 280

const SidePanelContext = createContext<{ close: () => void } | null>(null)

/**
 * Closes the panel with its exit animation.
 * Prefer this over calling the parent's `onClose` directly — that unmounts
 * instantly and skips the transition.
 */
export function useSidePanelClose(): () => void {
    const ctx = useContext(SidePanelContext)
    if (!ctx) throw new Error("useSidePanelClose must be used inside a <SidePanel>")
    return ctx.close
}

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
    onClose:    () => void
    /** Accessible name for the dialog. */
    ariaLabel:  string
    title?:     React.ReactNode
    icon?:      React.ReactNode
    /** Rendered under the header, above the scroll region (e.g. wallet balance). */
    subheader?: React.ReactNode
    children:   React.ReactNode
}

// ── SidePanel ─────────────────────────────────────────────────────────────────

export const SidePanel = ({
    onClose,
    ariaLabel,
    title,
    icon,
    subheader,
    children,
}: Props) => {
    const [visible, setVisible] = useState(false)

    // Enter animation — next frame, so the transition has a start state
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 10)
        return () => clearTimeout(t)
    }, [])

    // Exit animation, then unmount
    const close = useCallback(() => {
        setVisible(false)
        setTimeout(onClose, EXIT_MS)
    }, [onClose])

    // Escape to close
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [close])

    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => { document.body.style.overflow = prev }
    }, [])

    return (
        <SidePanelContext.Provider value={{ close }}>
            {/* Scrim */}
            <div
                className={`side-panel__scrim ${visible ? "side-panel__scrim--visible" : ""}`}
                onClick={close}
                aria-hidden="true"
            />

            {/* Panel */}
            <div
                className={`side-panel ${visible ? "side-panel--visible" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
            >
                {/* Drag handle — mobile sheet affordance only */}
                <div className="side-panel__handle" aria-hidden="true" />

                <header className="side-panel__header">
                    <div className="side-panel__header-left">
                        {icon}
                        {title && <h3 className="side-panel__title">{title}</h3>}
                    </div>

                    <button
                        type="button"
                        className="side-panel__close"
                        onClick={close}
                        aria-label="Close"
                    >
                        <X size={18} />
                    </button>
                </header>

                {subheader && (
                    <div className="side-panel__subheader">{subheader}</div>
                )}

                <div className="side-panel__content">
                    {children}
                </div>
            </div>
        </SidePanelContext.Provider>
    )
}