// components/creator/layout/SideNavItem.tsx
"use client"

import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import { NavItem } from "./nav-config"

type Props = {
    item: NavItem
    pathname: string
    openGroup: string | null
    onToggle: (label: string) => void
}

export const SideNavItem = ({ item, pathname, openGroup, onToggle }: Props) => {
    const isActive = item.href ? pathname === item.href : false
    const isGroup = !!item.children
    const isOpen = openGroup === item.label
    const groupActive = item.children?.some((c) => pathname.startsWith(c.href))

    if (isGroup) {
        return (
            <div className={`snav-group ${groupActive ? "snav-group--active" : ""}`}>
                <button
                    className={`snav-item snav-item--group ${groupActive ? "snav-item--group-active" : ""}`}
                    onClick={() => onToggle(item.label)}
                    aria-expanded={isOpen}
                >
                    <span className="snav-item__icon">{item.icon}</span>
                    <span className="snav-item__label">{item.label}</span>
                    <span className={`snav-item__chevron ${isOpen ? "snav-item__chevron--open" : ""}`}>
                        <ChevronDown size={14} />
                    </span>
                </button>

                <div className={`snav-children ${isOpen ? "snav-children--open" : ""}`}>
                    {item.children!.map((child) => (
                        <Link
                            key={child.href}
                            href={child.href}
                            className={`snav-child ${pathname === child.href ? "snav-child--active" : ""}`}
                        >
                            <ChevronRight size={12} />
                            {child.label}
                        </Link>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <Link
            href={item.href!}
            className={`snav-item ${isActive ? "snav-item--active" : ""}`}
        >
            <span className="snav-item__icon">{item.icon}</span>
            <span className="snav-item__label">{item.label}</span>
        </Link>
    )
}