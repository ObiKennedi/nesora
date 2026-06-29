// components/fan/layout/fan-nav-config.tsx
import {
    Home,
    Compass,
    PlaySquare,
    UserCircle
} from "lucide-react"

export type FanNavItem = {
    label:  string
    href:   string
    icon:   React.ReactNode
}

export const FAN_BOTTOM_NAV: FanNavItem[] = [
    {
        label: "Home",
        href:  "/fan/feed",
        icon:  <Home size={22} />,
    },
    {
        label: "Explore",
        href:  "/fan/discover",
        icon:  <Compass size={22} />,
    },
    // centre slot is the "+" wallet button — rendered separately in FanBottomNav
    {
        label: "Subscriptions",
        href:  "/fan/subscriptions",
        icon:  <PlaySquare size={22} />,
    },
    {
        label: "You",
        href:  "/fan/settings",
        icon:  <UserCircle size={22} />,
    }
]