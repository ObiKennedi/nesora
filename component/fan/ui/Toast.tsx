// component/ui/Toast.tsx
"use client"

import "@/styles/ui/toast.scss"

export type ToastVariant = "success" | "error" | "info"

const CONTAINER_ID = "nesora-toast-container"
const DURATION_MS  = 3500

function getContainer(): HTMLElement {
    let container = document.getElementById(CONTAINER_ID)
    if (!container) {
        container = document.createElement("div")
        container.id = CONTAINER_ID
        container.className = "toast-container"
        container.setAttribute("role", "status")
        container.setAttribute("aria-live", "polite")
        document.body.appendChild(container)
    }
    return container
}

export function showToast(message: string, variant: ToastVariant = "info") {
    // SSR guard — no-op on the server
    if (typeof document === "undefined") return

    const container = getContainer()

    const toast = document.createElement("div")
    toast.className   = `toast toast--${variant}`
    toast.textContent = message

    container.appendChild(toast)

    // enter
    requestAnimationFrame(() => toast.classList.add("toast--visible"))

    // exit + remove
    const dismiss = () => {
        toast.classList.remove("toast--visible")
        toast.addEventListener("transitionend", () => toast.remove(), { once: true })
        // Fallback removal in case transitionend never fires (reduced motion)
        setTimeout(() => toast.remove(), 400)
    }

    const timer = setTimeout(dismiss, DURATION_MS)

    // Tap to dismiss early
    toast.addEventListener("click", () => {
        clearTimeout(timer)
        dismiss()
    })
}