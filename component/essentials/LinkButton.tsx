"use client"

import { useRouter } from "next/navigation"

interface RedirectButton {
    path: string;
    children: React.ReactNode;
    className?: string;
}

export const RedirectButton = (
    {
        path,
        children,
        className
    }: RedirectButton
) => {

    const router = useRouter()

    return (
        <button onClick={() => router.push(path)} className={className}>
            {children}
        </button>
    )
}