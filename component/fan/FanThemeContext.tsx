"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"

interface FanThemeContextType {
    theme: Theme
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
}

const FanThemeContext = createContext<FanThemeContextType | undefined>(undefined)

export function FanThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("light")

    useEffect(() => {
        const savedTheme = localStorage.getItem("fan-theme") as Theme
        if (savedTheme === "light" || savedTheme === "dark") {
            setThemeState(savedTheme)
        } else {
            const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
            setThemeState(prefersDark ? "dark" : "light")
        }
    }, [])

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme)
    }, [theme])

    const toggleTheme = () => {
        const nextTheme = theme === "light" ? "dark" : "light"
        setThemeState(nextTheme)
        localStorage.setItem("fan-theme", nextTheme)
    }

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme)
        localStorage.setItem("fan-theme", newTheme)
    }

    return (
        <FanThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </FanThemeContext.Provider>
    )
}

export function useFanTheme() {
    const context = useContext(FanThemeContext)
    if (context === undefined) {
        throw new Error("useFanTheme must be used within a FanThemeProvider")
    }
    return context
}
