// component/admin/AdminSidebar.tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
    LayoutDashboard,
    Banknote,
    ShieldCheck,
    Users,
    ScrollText,
    LogOut,
} from "lucide-react"

const NAV_ITEMS = [
    { href: "/admin",         label: "Overview",   icon: LayoutDashboard, exact: true },
    { href: "/admin/payouts", label: "Payouts",    icon: Banknote },
    { href: "/admin/kyc",     label: "KYC Review", icon: ShieldCheck },
    { href: "/admin/users",   label: "Users",      icon: Users },
    { href: "/admin/audit",   label: "Audit Log",  icon: ScrollText },
] as const

type Props = {
    name:  string
    image: string | null
}

export function AdminSidebar({ name, image }: Props) {
    const pathname = usePathname()

    const isActive = (href: string, exact?: boolean) =>
        exact ? pathname === href : pathname.startsWith(href)

    return (
        <aside className="admin-sidebar">
            <div className="admin-sidebar__brand">
                <Link href="/admin" className="admin-sidebar__logo">
                    NESORA
                </Link>
                <span className="admin-sidebar__badge">Admin</span>
            </div>

            <nav className="admin-sidebar__nav">
                {NAV_ITEMS.map(({ href, label, icon: Icon, ...rest }) => (
                    <Link
                        key={href}
                        href={href}
                        className={`admin-sidebar__link${
                            isActive(href, "exact" in rest ? rest.exact : false)
                                ? " admin-sidebar__link--active"
                                : ""
                        }`}
                    >
                        <Icon className="admin-sidebar__link-icon" size={18} strokeWidth={1.8} />
                        <span className="admin-sidebar__link-label">{label}</span>
                    </Link>
                ))}
            </nav>

            <div className="admin-sidebar__footer">
                <div className="admin-sidebar__user">
                    {image ? (
                        <Image
                            src={image}
                            alt={name}
                            width={32}
                            height={32}
                            className="admin-sidebar__avatar"
                        />
                    ) : (
                        <span className="admin-sidebar__avatar admin-sidebar__avatar--fallback">
                            {name.charAt(0).toUpperCase()}
                        </span>
                    )}
                    <span className="admin-sidebar__user-name">{name}</span>
                </div>

                <button
                    type="button"
                    className="admin-sidebar__logout"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut size={16} strokeWidth={1.8} />
                    <span>Sign out</span>
                </button>
            </div>
        </aside>
    )
}