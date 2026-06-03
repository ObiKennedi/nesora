"use client"

import { useState } from "react";
import { RedirectButton } from "../essentials/LinkButton";
import { Menu, X } from "lucide-react";
import "@/styles/landing-page/NavBar.scss"
import { useRouter } from "next/navigation"

const NavLinks = [
    {
        id: 1,
        name: "About Us",
        url: "#about",
    },
    {
        id: 2,
        name: "Features",
        url: "#features",
    },
    {
        id: 3,
        name: "Creators",
        url: "#creators",
    },
    {
        id: 4,
        name: "FAQ",
        url: "#faq",
    },
    {
        id: 5,
        name: "Contact",
        url: "#help",
    },
]

const Navbar = () => {

    const [isNavOpen, setIsNavOpen] = useState<boolean>(false);

    const handleNav = () => {
        setIsNavOpen(!isNavOpen)
    }

    const router = useRouter()

    return (
        <header>
            <img
                src="/logo.png"
                alt="logo"
                onClick={() => router.push("/#")}
            />

            <nav className={isNavOpen ? "open" : "close"}>
                <ul>
                    {NavLinks.map((link) => (
                        <li key={link.id}>
                            <a href={link.url}>{link.name}</a>
                        </li>
                    ))}
                </ul>

                <RedirectButton
                    className="header-redirect"
                    path="/login"
                >Get Started</RedirectButton>
            </nav>

            <button
                className="mobile-nav"
                onClick={handleNav}
            >
                {isNavOpen ? <X /> : <Menu />}
            </button>
        </header>
    )
}

export default Navbar;