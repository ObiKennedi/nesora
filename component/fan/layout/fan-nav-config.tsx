// components/fan/layout/fan-nav-config.tsx
import {
    Home,
    Clapperboard,
    Radio,
    MessageCircle,
    Compass,
    PlaySquare,
    UserCircle,
    CreditCard,
} from "lucide-react"

export type FanNavItem = {
    label: string
    href:  string
    icon:  React.ReactNode
    /** Which badge counter, if any, this item displays */
    badge?: "live" | "unread"
}

// ── Desktop sidebar — the full navigation surface ─────────────────────────────

export const FAN_SIDE_NAV: FanNavItem[] = [
    { label: "Home",          href: "/fan/feed",          icon: <Home         size={22} /> },
    { label: "Shorts",        href: "/fan/shorts",        icon: <Clapperboard size={22} /> },
    { label: "Live",          href: "/fan/live",          icon: <Radio        size={22} />, badge: "live"   },
    { label: "Messages",      href: "/fan/messages",      icon: <MessageCircle size={22} />, badge: "unread" },
    { label: "Explore",       href: "/fan/discover",      icon: <Compass      size={22} /> },
    { label: "Subscriptions", href: "/fan/subscriptions", icon: <PlaySquare   size={22} /> },
    { label: "Billing",       href: "/fan/billing",       icon: <CreditCard   size={22} /> },
    { label: "You",           href: "/fan/settings",      icon: <UserCircle   size={22} /> },
]


// ── Mobile bottom nav — the four majors, wallet occupies the centre slot ──────
// Shorts and Live are reachable from the feed's top tab strip instead.

export const FAN_BOTTOM_NAV: FanNavItem[] = [
    { label: "Home",     href: "/fan/feed",     icon: <Home          size={22} /> },
    { label: "Explore",  href: "/fan/discover", icon: <Compass       size={22} /> },
    // ── centre "+" wallet button rendered separately ──
    { label: "Messages", href: "/fan/messages", icon: <MessageCircle size={22} />, badge: "unread" },
    { label: "You",      href: "/fan/settings", icon: <UserCircle    size={22} /> },
]