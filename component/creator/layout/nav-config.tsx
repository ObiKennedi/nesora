// components/creator/layout/nav-config.tsx
import {
    LayoutDashboard, FileText, Users,
    Radio, MessageCircle, BarChart2,
    Wallet, BadgeDollarSign, UserCircle,
    ShieldCheck, Settings, Phone
} from "lucide-react"

export type NavChild = { label: string; href: string }

export type NavItem = {
    label: string
    href?: string
    icon: React.ReactNode
    children?: NavChild[]
}

export const NAV: NavItem[] = [
    {
        label: "Dashboard",
        href: "/creator/dashboard",
        icon: <LayoutDashboard size={18} />,
    },
    {
        label: "Content",
        icon: <FileText size={18} />,
        children: [
            { label: "Feed", href: "/creator/content/feed" },
            { label: "Drafts", href: "/creator/content/drafts" },
            { label: "Scheduled", href: "/creator/content/scheduled" },
        ],
    },
    {
        label: "Calls",
        href:"/creator/calls",
        icon: <Phone size={18}/>,
    },
    {
        label: "Audience",
        icon: <Users size={18} />,
        children: [
            { label: "Followers", href: "/creator/audience/followers" },
            { label: "Subscribers", href: "/creator/audience/subscribers" },
            { label: "Top Fans", href: "/creator/audience/top-fans" },
        ],
    },
    {
        label: "Live",
        href: "/creator/live",
        icon: <Radio size={18} />,
    },
    {
        label: "Messages",
        href: "/creator/messages",
        icon: <MessageCircle size={18} />,
    },
    {
        label: "Analytics",
        href: "/creator/analytics",
        icon: <BarChart2 size={18} />,
    },
    {
        label: "Monetization",
        icon: <BadgeDollarSign size={18} />,
        children: [
            { label: "Wallet", href: "/creator/monetization/wallet" },
            { label: "Subscription Plans", href: "/creator/monetization/subscriptions" },
            { label: "Payouts", href: "/creator/monetization/payouts" },
        ],
    },
    {
        label: "Profile",
        href: "/creator/profile",
        icon: <UserCircle size={18} />,
    },
    {
        label: "Verification",
        href: "/creator/verification",
        icon: <ShieldCheck size={18} />,
    },
    {
        label: "Settings",
        href: "/creator/settings",
        icon: <Settings size={18} />,
    },
]

export const MOBILE_NAV: NavItem[] = [
    { label: "Home", href: "/creator/dashboard", icon: <LayoutDashboard size={20} /> },
    { label: "Content", href: "/creator/content/feed", icon: <FileText size={20} /> },
    { label: "Audience", href: "/creator/audience/followers", icon: <Users size={20} /> },
    { label: "Messages", href: "/creator/messages", icon: <MessageCircle size={20} /> },
    { label: "Wallet", href: "/creator/monetization/wallet", icon: <Wallet size={20} /> },
]

export const getPageTitle = (pathname: string): string => {
    for (const item of NAV) {
        if (item.href && pathname === item.href) return item.label
        if (item.children) {
            const child = item.children.find((c) => pathname === c.href)
            if (child) return `${item.label} — ${child.label}`
        }
    }
    return "Dashboard"
}