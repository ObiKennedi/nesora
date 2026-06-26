// components/creator/dashboard/QuickActions.tsx
import Link from "next/link"
import {
    PenLine, Radio, Video,
    Megaphone, BadgeDollarSign, ImagePlus,
} from "lucide-react"
import "@/styles/creator/dashboard/QuickActions.scss"

const ACTIONS = [
    {
        label: "Create Post",
        icon: <PenLine size={20} />,
        href: "/creator/content/feed?action=new",
        color: "primary",
    },
    {
        label: "Go Live",
        icon: <Radio size={20} />,
        href: "/creator/live",
        color: "red",
    },
    {
        label: "Upload Video",
        icon: <Video size={20} />,
        href: "/creator/content/feed?action=video",
        color: "blue",
    },
    {
        label: "Announcement",
        icon: <Megaphone size={20} />,
        href: "/creator/content/feed?action=announcement",
        color: "amber",
    },
    {
        label: "Upload Photo",
        icon: <ImagePlus size={20} />,
        href: "/creator/content/feed?action=photo",
        color: "green",
    },
    {
        label: "New Sub Plan",
        icon: <BadgeDollarSign size={20} />,
        href: "/creator/monetization/subscriptions?action=new",
        color: "purple",
    },
]

export const QuickActions = () => {
    return (
        <div className="quick-actions">
            <h2 className="dashboard-section-title">Quick Actions</h2>
            <div className="quick-actions__grid">
                {ACTIONS.map((action) => (
                    <Link
                        key={action.label}
                        href={action.href}
                        className={`quick-action quick-action--${action.color}`}
                    >
                        <span className="quick-action__icon">{action.icon}</span>
                        <span className="quick-action__label">{action.label}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}