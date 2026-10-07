// components/fan/films/FilmsClient.tsx
"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import {
    Play,
    Volume2,
    VolumeX,
    MoreVertical,
    Lock,
    ChevronRight,
    ChevronLeft,
    X,
    Heart,
    Bookmark,
    Share2,
    Star,
    Film as FilmIcon,
    Flame,
    Sparkles,
} from "lucide-react"
import { FeedTopTabs } from "@/component/fan/feed/FeedTopTabs"
import { Film } from "@/actions/fan/films"
import { likePostAction, unlikePostAction, savePostAction, recordShareAction } from "@/actions/fan/interactions"
import { formatDistanceToNow } from "date-fns"
import "@/styles/fan/Films.scss"

type Props = {
    heroFilm:     Film
    newThisWeek:  Film[]
    trendingNow:  Film[]
    creatorFilms: Film[]
    allFilms:     Film[]
    currentUserId: string
}

function fmtDuration(secs: number | null): string {
    if (!secs) return "2h 10m"
    if (secs >= 3600) {
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        return `${h}:${String(m).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`
    }
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, "0")}`
}

function fmtViews(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
}

function fmtTimeAgo(date: Date | string): string {
    try {
        return formatDistanceToNow(new Date(date), { addSuffix: true })
    } catch {
        return "recently"
    }
}

export function FilmsClient({
    heroFilm,
    newThisWeek,
    trendingNow,
    creatorFilms,
    allFilms,
    currentUserId,
}: Props) {
    const [activeHero, setActiveHero] = useState<Film>(heroFilm)
    const [playingFilm, setPlayingFilm] = useState<Film | null>(null)
    const [isMuted, setIsMuted] = useState(false)
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

    // Refs for horizontal rail scrolling on desktop
    const newRailRef = useRef<HTMLDivElement>(null)
    const trendingRailRef = useRef<HTMLDivElement>(null)
    const creatorRailRef = useRef<HTMLDivElement>(null)

    const scrollRail = (ref: React.RefObject<HTMLDivElement | null>, offset: number) => {
        if (ref.current) {
            ref.current.scrollBy({ left: offset, behavior: "smooth" })
        }
    }

    const handleShare = async (f: Film) => {
        const url = `${window.location.origin}/fan/films/${f.id}`
        try {
            if (navigator.share) await navigator.share({ title: f.title, url })
            else await navigator.clipboard.writeText(url)
        } catch {}
        await recordShareAction(f.id)
    }

    return (
        <div className="films-page">
            {/* ── Top Tabs (Socials / Films / Shorts / Live) ── */}
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 16px" }}>
                <FeedTopTabs />
            </div>

            {/* ─────────────────────────────────────────────────────────────────
                DESKTOP LAYOUT (≥1024px) — Netflix-style Streaming Cinema
            ────────────────────────────────────────────────────────────────── */}
            <div className="films-desktop">
                {/* ── Hero Banner ── */}
                <section className="films-hero">
                    <img
                        src={activeHero.backdropUrl || activeHero.thumbnailUrl || "/logo.png"}
                        alt={activeHero.title}
                        className="films-hero__backdrop"
                    />
                    <div className="films-hero__gradient-bottom" />
                    <div className="films-hero__gradient-left" />

                    <div className="films-hero__content">
                        <span className="films-hero__badge">
                            <Sparkles size={12} />
                            {activeHero.tag || "NESORA ORIGINAL"}
                        </span>

                        <h1 className="films-hero__title">{activeHero.title}</h1>

                        <div className="films-hero__meta">
                            <span className="films-hero__rating">
                                <Star size={12} fill="#facc15" strokeWidth={0} />
                                {activeHero.rating || "8.8/10"}
                            </span>
                            <span className="films-hero__streams">
                                {activeHero.streamBadge || `${fmtViews(activeHero.viewCount)} Streams`}
                            </span>
                            <span className="films-hero__duration">
                                {fmtDuration(activeHero.videoDuration)}
                            </span>
                            <span className="films-hero__quality">
                                {activeHero.quality || "4K Ultra HD"}
                            </span>
                            <span>{activeHero.genre || "Drama / Series"}</span>
                        </div>

                        <p className="films-hero__synopsis">{activeHero.synopsis}</p>

                        <div className="films-hero__actions">
                            <button
                                type="button"
                                className="films-hero__play-btn"
                                onClick={() => setPlayingFilm(activeHero)}
                            >
                                <Play size={18} fill="white" />
                                Play
                            </button>

                            <button
                                type="button"
                                className="films-hero__trailer-btn"
                                onClick={() => setPlayingFilm(activeHero)}
                            >
                                Watch Trailer
                            </button>
                        </div>
                    </div>
                </section>

                {/* ── Rail: New this week ── */}
                <section className="films-rail">
                    <div className="films-rail__header">
                        <h2 className="films-rail__title">
                            <Sparkles size={18} color="#f59e0b" />
                            New this week
                        </h2>
                    </div>

                    <div className="films-rail__track-wrapper">
                        <button
                            type="button"
                            className="films-rail__arrow films-rail__arrow--left"
                            onClick={() => scrollRail(newRailRef, -450)}
                            aria-label="Scroll left"
                        >
                            <ChevronLeft size={22} />
                        </button>

                        <div className="films-rail__track" ref={newRailRef}>
                            {newThisWeek.map((film) => (
                                <button
                                    key={film.id}
                                    type="button"
                                    className="film-poster"
                                    onClick={() => {
                                        setActiveHero(film)
                                        setPlayingFilm(film)
                                    }}
                                >
                                    <div className="film-poster__thumb">
                                        <img
                                            src={film.posterUrl || film.thumbnailUrl || "/logo.png"}
                                            alt={film.title}
                                            loading="lazy"
                                        />
                                        <span className="film-poster__duration">
                                            {fmtDuration(film.videoDuration)}
                                        </span>
                                        {!film.hasAccess && (
                                            <div className="film-poster__lock">
                                                <Lock size={16} />
                                                <span>Unlock</span>
                                            </div>
                                        )}
                                        <div className="film-poster__hover-overlay">
                                            <div className="film-poster__play-circle">
                                                <Play size={20} fill="white" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="film-poster__info">
                                        <span className="film-poster__title">{film.title}</span>
                                        <span className="film-poster__creator">
                                            {film.creator.displayName}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            className="films-rail__arrow films-rail__arrow--right"
                            onClick={() => scrollRail(newRailRef, 450)}
                            aria-label="Scroll right"
                        >
                            <ChevronRight size={22} />
                        </button>
                    </div>
                </section>

                {/* ── Rail: Trending Now ── */}
                <section className="films-rail">
                    <div className="films-rail__header">
                        <h2 className="films-rail__title">
                            <Flame size={18} color="#ef4444" />
                            Trending Now
                        </h2>
                    </div>

                    <div className="films-rail__track-wrapper">
                        <button
                            type="button"
                            className="films-rail__arrow films-rail__arrow--left"
                            onClick={() => scrollRail(trendingRailRef, -450)}
                            aria-label="Scroll left"
                        >
                            <ChevronLeft size={22} />
                        </button>

                        <div className="films-rail__track" ref={trendingRailRef}>
                            {trendingNow.map((film) => (
                                <button
                                    key={film.id}
                                    type="button"
                                    className="film-poster"
                                    onClick={() => {
                                        setActiveHero(film)
                                        setPlayingFilm(film)
                                    }}
                                >
                                    <div className="film-poster__thumb">
                                        <img
                                            src={film.posterUrl || film.thumbnailUrl || "/logo.png"}
                                            alt={film.title}
                                            loading="lazy"
                                        />
                                        <span className="film-poster__duration">
                                            {fmtDuration(film.videoDuration)}
                                        </span>
                                        {!film.hasAccess && (
                                            <div className="film-poster__lock">
                                                <Lock size={16} />
                                                <span>Unlock</span>
                                            </div>
                                        )}
                                        <div className="film-poster__hover-overlay">
                                            <div className="film-poster__play-circle">
                                                <Play size={20} fill="white" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="film-poster__info">
                                        <span className="film-poster__title">{film.title}</span>
                                        <span className="film-poster__creator">
                                            {film.creator.displayName}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            className="films-rail__arrow films-rail__arrow--right"
                            onClick={() => scrollRail(trendingRailRef, 450)}
                            aria-label="Scroll right"
                        >
                            <ChevronRight size={22} />
                        </button>
                    </div>
                </section>

                {/* ── Rail: Creator Exclusives ── */}
                {creatorFilms.length > 0 && (
                    <section className="films-rail">
                        <div className="films-rail__header">
                            <h2 className="films-rail__title">
                                <FilmIcon size={18} color="#38bdf8" />
                                Creator Exclusives &amp; Series
                            </h2>
                        </div>

                        <div className="films-rail__track-wrapper">
                            <button
                                type="button"
                                className="films-rail__arrow films-rail__arrow--left"
                                onClick={() => scrollRail(creatorRailRef, -450)}
                                aria-label="Scroll left"
                            >
                                <ChevronLeft size={22} />
                            </button>

                            <div className="films-rail__track" ref={creatorRailRef}>
                                {creatorFilms.map((film) => (
                                    <button
                                        key={film.id}
                                        type="button"
                                        className="film-poster"
                                        onClick={() => {
                                            setActiveHero(film)
                                            setPlayingFilm(film)
                                        }}
                                    >
                                        <div className="film-poster__thumb">
                                            <img
                                                src={film.posterUrl || film.thumbnailUrl || "/logo.png"}
                                                alt={film.title}
                                                loading="lazy"
                                            />
                                            <span className="film-poster__duration">
                                                {fmtDuration(film.videoDuration)}
                                            </span>
                                            <div className="film-poster__hover-overlay">
                                                <div className="film-poster__play-circle">
                                                    <Play size={20} fill="white" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="film-poster__info">
                                            <span className="film-poster__title">{film.title}</span>
                                            <span className="film-poster__creator">
                                                {film.creator.displayName}
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                className="films-rail__arrow films-rail__arrow--right"
                                onClick={() => scrollRail(creatorRailRef, 450)}
                                aria-label="Scroll right"
                            >
                                <ChevronRight size={22} />
                            </button>
                        </div>
                    </section>
                )}
            </div>

            {/* ─────────────────────────────────────────────────────────────────
                MOBILE LAYOUT (<1024px) — YouTube-style Vertical Feed
            ────────────────────────────────────────────────────────────────── */}
            <div className="films-mobile">
                <div className="films-mobile-feed">
                    {allFilms.map((film) => (
                        <article
                            key={film.id}
                            className="film-card-mobile"
                            onClick={() => setPlayingFilm(film)}
                        >
                            {/* 16:9 Thumbnail Container */}
                            <div className="film-card-mobile__thumb-wrap">
                                <img
                                    src={film.thumbnailUrl || film.backdropUrl || "/logo.png"}
                                    alt={film.title}
                                    loading="lazy"
                                />

                                {/* Duration Badge (bottom-right) */}
                                <span className="film-card-mobile__duration">
                                    {fmtDuration(film.videoDuration)}
                                </span>

                                {/* CC Badge */}
                                <span className="film-card-mobile__cc-badge">CC</span>

                                {/* Mute Button (top-right) */}
                                <button
                                    type="button"
                                    className="film-card-mobile__mute-btn"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setIsMuted((m) => !m)
                                    }}
                                    aria-label={isMuted ? "Unmute" : "Mute"}
                                >
                                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                </button>

                                {/* Lock Overlay if paywalled */}
                                {!film.hasAccess && (
                                    <div className="film-card-mobile__lock-badge">
                                        <Lock size={20} />
                                        <span>
                                            {film.lockReason === "SUBSCRIBERS_ONLY"
                                                ? "Subscribers only"
                                                : "Members only"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Details (Avatar, Title, Views, 3 dots) */}
                            <div className="film-card-mobile__details">
                                <div className="film-card-mobile__avatar">
                                    {film.creator.image ? (
                                        <img
                                            src={film.creator.image}
                                            alt={film.creator.displayName}
                                        />
                                    ) : (
                                        <span>{film.creator.displayName.charAt(0)}</span>
                                    )}
                                </div>

                                <div className="film-card-mobile__meta">
                                    <h3 className="film-card-mobile__title">{film.title}</h3>
                                    <div className="film-card-mobile__sub">
                                        <span className="film-card-mobile__creator-name">
                                            {film.creator.displayName}
                                        </span>
                                        <span className="film-card-mobile__dot">·</span>
                                        <span className="film-card-mobile__views">
                                            ▷{fmtViews(film.viewCount)}
                                        </span>
                                        <span className="film-card-mobile__dot">·</span>
                                        <span>{fmtTimeAgo(film.publishedAt)}</span>
                                    </div>
                                    <span className="film-card-mobile__tag">
                                        {film.tag || "Dubbed"}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="film-card-mobile__menu-btn"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleShare(film)
                                    }}
                                    aria-label="Options"
                                >
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────────
                CINEMATIC THEATER MODAL (Full video player experience)
            ────────────────────────────────────────────────────────────────── */}
            {playingFilm && (
                <div
                    className="film-theater-modal"
                    onClick={() => setPlayingFilm(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label={playingFilm.title}
                >
                    <div
                        className="film-theater-modal__content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            className="film-theater-modal__close"
                            onClick={() => setPlayingFilm(null)}
                            aria-label="Close player"
                        >
                            <X size={20} />
                        </button>

                        <div className="film-theater-modal__player-wrap">
                            {playingFilm.hasAccess && playingFilm.mediaUrls[0] ? (
                                <video
                                    src={playingFilm.mediaUrls[0]}
                                    poster={playingFilm.backdropUrl || playingFilm.thumbnailUrl || undefined}
                                    controls
                                    autoPlay
                                    playsInline
                                />
                            ) : (
                                <div className="film-theater-modal__locked">
                                    <Lock size={36} color="#fbbf24" />
                                    <h3>This film is locked</h3>
                                    <p>
                                        {playingFilm.lockReason === "SUBSCRIBERS_ONLY"
                                            ? `Subscribe to ${playingFilm.creator.displayName} to unlock this full-length film.`
                                            : "Unlock this exclusive film to watch."}
                                    </p>
                                    <Link
                                        href={`/fan/${playingFilm.creator.handle ?? playingFilm.creator.id}`}
                                        className="film-theater-modal__unlock-btn"
                                    >
                                        {playingFilm.lockReason === "SUBSCRIBERS_ONLY"
                                            ? "Subscribe to Creator"
                                            : "View Creator Profile"}
                                    </Link>
                                </div>
                            )}
                        </div>

                        <div className="film-theater-modal__body">
                            <h2 className="film-theater-modal__title">{playingFilm.title}</h2>
                            <div className="film-theater-modal__meta">
                                <span>{fmtDuration(playingFilm.videoDuration)}</span>
                                <span>·</span>
                                <span>{fmtViews(playingFilm.viewCount)} views</span>
                                <span>·</span>
                                <span>{playingFilm.quality || "1080p HD"}</span>
                                <span>·</span>
                                <span>{fmtTimeAgo(playingFilm.publishedAt)}</span>
                            </div>
                            <p className="film-theater-modal__synopsis">{playingFilm.synopsis}</p>

                            <div className="film-theater-modal__footer">
                                <Link
                                    href={`/fan/${playingFilm.creator.handle ?? playingFilm.creator.id}`}
                                    className="film-theater-modal__creator"
                                >
                                    {playingFilm.creator.image ? (
                                        <img
                                            src={playingFilm.creator.image}
                                            alt={playingFilm.creator.displayName}
                                        />
                                    ) : (
                                        <div
                                            style={{
                                                width: 36,
                                                height: 36,
                                                borderRadius: "50%",
                                                background: "var(--color-primary)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {playingFilm.creator.displayName.charAt(0)}
                                        </div>
                                    )}
                                    <span>{playingFilm.creator.displayName}</span>
                                </Link>

                                <div className="film-theater-modal__actions">
                                    <button
                                        type="button"
                                        className="film-theater-modal__action-btn"
                                        onClick={() => handleShare(playingFilm)}
                                    >
                                        <Share2 size={15} />
                                        Share
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
