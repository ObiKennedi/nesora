// components/fan/layout/FanTopBar.tsx
"use client"

import { useState, useRef, useEffect, Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, ArrowLeft, Loader2, BadgeCheck } from "lucide-react"
import { NotificationsBell } from "@/component/creator/layout/NotificationsBell"
import { getDiscoverCreatorsAction } from "@/actions/fan/discover"
import "@/styles/fan/FanLayout.scss"

type SuggestionCreator = {
    id:          string
    displayName: string
    handle:      string | null
    image:       string | null
    isVerified:  boolean
}

function FanTopBarContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [query, setQuery] = useState("")
    const [isOpenMobile, setIsOpenMobile] = useState(false)
    const [suggestions, setSuggestions] = useState<SuggestionCreator[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showDropdown, setShowDropdown] = useState(false)

    const inputRef = useRef<HTMLInputElement>(null)
    const mobileInputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Sync query from URL if user is on discover with a search query
    useEffect(() => {
        const urlSearch = searchParams.get("search") || searchParams.get("q")
        if (urlSearch && urlSearch !== "1") {
            setQuery(urlSearch)
        }
    }, [searchParams])

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Debounced search suggestions
    useEffect(() => {
        const trimmed = query.trim()
        if (trimmed.length < 2) {
            setSuggestions([])
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        const timer = setTimeout(async () => {
            try {
                const res = await getDiscoverCreatorsAction({ search: trimmed, limit: 5 })
                if (res?.creators) {
                    setSuggestions(
                        res.creators.map((c) => ({
                            id:          c.id,
                            displayName: c.displayName,
                            handle:      c.handle,
                            image:       c.image,
                            isVerified:  c.isVerified,
                        }))
                    )
                }
            } catch {
                setSuggestions([])
            } finally {
                setIsLoading(false)
            }
        }, 250)

        return () => clearTimeout(timer)
    }, [query])

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        setShowDropdown(false)
        setIsOpenMobile(false)
        const trimmed = query.trim()
        if (trimmed) {
            router.push(`/fan/discover?search=${encodeURIComponent(trimmed)}`)
        } else {
            router.push("/fan/discover")
        }
    }

    const handleOpenMobile = () => {
        setIsOpenMobile(true)
        setShowDropdown(query.trim().length >= 2)
        setTimeout(() => mobileInputRef.current?.focus(), 60)
    }

    const handleCloseMobile = () => {
        setIsOpenMobile(false)
        setShowDropdown(false)
    }

    const handleSelectCreator = (handleOrId: string) => {
        setShowDropdown(false)
        setIsOpenMobile(false)
        router.push(`/fan/${handleOrId}`)
    }

    return (
        <header className="fan-topbar">
            {/* Logo — shown on mobile; hidden on desktop where sidebar already displays logo */}
            <Link href="/fan/feed" className="fan-topbar__logo">
                <img
                    src="/logo.png"
                    alt="NESORA"
                    width={100}
                    height={26}
                />
            </Link>

            {/* Desktop search bar & mobile expandable search bar */}
            <div
                ref={containerRef}
                className={`fan-topbar__search-container ${isOpenMobile ? "fan-topbar__search-container--mobile-open" : ""}`}
            >
                {isOpenMobile && (
                    <button
                        type="button"
                        className="fan-topbar__search-back"
                        onClick={handleCloseMobile}
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}

                <form
                    onSubmit={handleSearchSubmit}
                    className="fan-topbar__search-form"
                    role="search"
                >
                    <button
                        type="submit"
                        className="fan-topbar__search-btn"
                        aria-label="Search"
                    >
                        <Search size={18} />
                    </button>

                    <input
                        ref={isOpenMobile ? mobileInputRef : inputRef}
                        type="text"
                        className="fan-topbar__search-input"
                        placeholder="Search creators, categories..."
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value)
                            setShowDropdown(true)
                        }}
                        onFocus={() => {
                            if (query.trim().length >= 2) setShowDropdown(true)
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setShowDropdown(false)
                                if (isOpenMobile) handleCloseMobile()
                            }
                        }}
                    />

                    {query && (
                        <button
                            type="button"
                            className="fan-topbar__search-clear"
                            onClick={() => {
                                setQuery("")
                                setSuggestions([])
                                setShowDropdown(false)
                                const el = isOpenMobile ? mobileInputRef.current : inputRef.current
                                el?.focus()
                            }}
                            aria-label="Clear search"
                        >
                            <X size={13} />
                        </button>
                    )}
                </form>

                {/* Suggestions Dropdown */}
                {showDropdown && query.trim().length >= 2 && (
                    <div className="fan-topbar__dropdown">
                        {isLoading ? (
                            <div className="fan-topbar__dropdown-loading">
                                <Loader2 size={16} className="spin" />
                                <span>Searching creators...</span>
                            </div>
                        ) : suggestions.length > 0 ? (
                            <>
                                <div className="fan-topbar__dropdown-list">
                                    {suggestions.map((c) => (
                                        <div
                                            key={c.id}
                                            className="fan-topbar__dropdown-item"
                                            onClick={() => handleSelectCreator(c.handle ?? c.id)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="fan-topbar__dropdown-avatar">
                                                {c.image ? (
                                                    <img src={c.image} alt={c.displayName} />
                                                ) : (
                                                    <span>{c.displayName.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="fan-topbar__dropdown-meta">
                                                <span className="fan-topbar__dropdown-name">
                                                    {c.displayName}
                                                    {c.isVerified && <BadgeCheck size={13} className="fan-topbar__verified" />}
                                                </span>
                                                {c.handle && (
                                                    <span className="fan-topbar__dropdown-handle">
                                                        @{c.handle}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="fan-topbar__dropdown-footer">
                                    <button
                                        type="button"
                                        className="fan-topbar__dropdown-all-btn"
                                        onClick={handleSearchSubmit}
                                    >
                                        <Search size={14} />
                                        <span>See all results for &ldquo;{query}&rdquo;</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="fan-topbar__dropdown-empty">
                                <p>No creators match &ldquo;{query}&rdquo;</p>
                                <button
                                    type="button"
                                    className="fan-topbar__dropdown-all-btn"
                                    onClick={handleSearchSubmit}
                                >
                                    Search on Discover &rarr;
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Right actions */}
            <div className="fan-topbar__right">
                {/* Mobile Search Icon Toggle Button */}
                <button
                    type="button"
                    className="fan-topbar__icon-btn fan-topbar__icon-btn--search"
                    aria-label="Search"
                    onClick={handleOpenMobile}
                >
                    <Search size={20} />
                </button>

                {/* Reuse the creator notifications bell */}
                <NotificationsBell />
            </div>
        </header>
    )
}

export const FanTopBar = () => {
    return (
        <Suspense fallback={
            <header className="fan-topbar">
                <Link href="/fan/feed" className="fan-topbar__logo">
                    <img src="/logo.png" alt="NESORA" width={100} height={26} />
                </Link>
                <div className="fan-topbar__right">
                    <NotificationsBell />
                </div>
            </header>
        }>
            <FanTopBarContent />
        </Suspense>
    )
}