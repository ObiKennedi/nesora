// components/creator/layout/CreatorSidebar.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { X, LogOut } from "lucide-react"
import { useState } from "react"
import { NAV } from "./nav-config"
import { SideNavItem } from "./SideNavItem"

type Props = {
    isOpen: boolean
    onClose: () => void
}

export const CreatorSidebar = ({ isOpen, onClose }: Props) => {
    const pathname = usePathname()
    const { data: session } = useSession()

    const [openGroup, setOpenGroup] = useState<string | null>(() => {
        const active = NAV.find((item) =>
            item.children?.some((c) => pathname.startsWith(c.href))
        )
        return active?.label ?? null
    })

    const handleToggle = (label: string) => {
        setOpenGroup((prev) => (prev === label ? null : label))
    }

    return (
        <aside className={`creator-sidebar ${isOpen ? "creator-sidebar--open" : ""}`}>

            {/* Logo */}
            <div className="creator-sidebar__logo">
                <Link href="/creator/dashboard" onClick={onClose}>
                    <Image src="/logo.png" alt="NESORA" width={110} height={28} priority />
                </Link>
                <button
                    className="creator-sidebar__close"
                    onClick={onClose}
                    aria-label="Close menu"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Mini profile */}
            <div className="creator-sidebar__profile">
                <div className="creator-sidebar__avatar">
                    {session?.user?.image
                        ? <Image src={session.user.image} alt="Avatar" width={36} height={36} />
                        : <span>{session?.user?.name?.charAt(0) ?? "C"}</span>
                    }
                </div>
                <div className="creator-sidebar__meta">
                    <p className="creator-sidebar__name">
                        {session?.user?.name ?? "Creator"}
                    </p>
                    <p className="creator-sidebar__handle">
                        @{session?.user?.username ?? "—"}
                    </p>
                </div>
            </div>

            {/* Nav */}
            <nav className="creator-sidebar__nav" aria-label="Creator navigation">
                {NAV.map((item) => (
                    <SideNavItem
                        key={item.label}
                        item={item}
                        pathname={pathname}
                        openGroup={openGroup}
                        onToggle={handleToggle}
                    />
                ))}
            </nav>

            {/* Sign out */}
            <button
                className="creator-sidebar__signout"
                onClick={() => signOut({ callbackUrl: "/login" })}
            >
                <LogOut size={16} />
                Sign Out
            </button>
        </aside>
    )
}