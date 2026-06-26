// components/creator/layout/CreatorHeader.tsx
"use client"

import Image from "next/image"
import { useSession } from "next-auth/react"
import { Menu } from "lucide-react"
import { NotificationsBell } from "./NotificationsBell"

type Props = {
    pageTitle: string
    onMenuOpen: () => void
}

export const CreatorHeader = ({ pageTitle, onMenuOpen }: Props) => {
    const { data: session } = useSession()

    return (
        <header className="creator-header">
            <div className="creator-header__left">
                <button
                    className="creator-header__menu-btn"
                    onClick={onMenuOpen}
                    aria-label="Open menu"
                >
                    <Menu size={20} />
                </button>
                <h1 className="creator-header__title">{pageTitle}</h1>
            </div>

            <div className="creator-header__right">
                <NotificationsBell />

                <div className="creator-header__avatar">
                    {session?.user?.image
                        ? <img
                            key={session.user.image}   // ← forces remount when URL changes
                            src={session.user.image}
                            alt="Avatar"
                            width={32}
                            height={32}               // ← bypasses Next.js image cache
                        />
                        : <span>
                            {session?.user?.name?.charAt(0) ?? "C"}
                        </span>
                    }
                </div>
            </div>
        </header>
    )
}