import { RedirectButton } from "../essentials/LinkButton"
import { Send } from "lucide-react"
import { FaTiktok, FaTwitter, FaYoutube, FaInstagram } from "react-icons/fa"
import "@/styles/landing-page/Footer.scss"

const footerLinks = {
    Platform: [
        { name: "About Us", url: "#about" },
        { name: "Features", url: "#features" },
        { name: "For Creators", url: "#creators" },
        { name: "FAQ", url: "#faq" },
        { name: "Contact", url: "#contact" },
    ],
    Creators: [
        { name: "Become a Creator", url: "/register" },
        { name: "Creator Handbook", url: "/handbook" },
        { name: "Monetization Guide", url: "/monetization" },
        { name: "Verification", url: "/verify" },
        { name: "Creator Dashboard", url: "/dashboard" },
    ],
    Legal: [
        { name: "Terms of Service", url: "/terms" },
        { name: "Privacy Policy", url: "/privacy" },
        { name: "Cookie Policy", url: "/cookies" },
        { name: "Content Policy", url: "/content" },
    ],
}

const socials = [
    { icon: <FaInstagram size={18} />, url: "#", label: "Instagram" },
    { icon: <FaTwitter size={18} />, url: "#", label: "Twitter / X" },
    { icon: <FaTiktok size={16} />, url: "#", label: "TikTok" },
    { icon: <FaYoutube size={18} />, url: "#", label: "YouTube" },
]

export const Footer = () => {
    return (
        <footer className="footer">

            {/* ── Newsletter Banner ── */}
            <div className="footer-newsletter">
                <div className="footer-newsletter__inner">
                    <div className="footer-newsletter__text">
                        <h3>Stay in the loop</h3>
                        <p>
                            Be the first to know when NESORA launches.
                            No spam — just the good stuff.
                        </p>
                    </div>
                    <div className="footer-newsletter__form">
                        <input
                            type="email"
                            placeholder="Enter your email"
                        />
                        <button>
                            <Send size={15} />
                            Notify Me
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Main Footer Body ── */}
            <div className="footer-body">
                <div className="footer-inner">

                    {/* Brand col */}
                    <div className="footer-brand">
                        <a href="/" className="footer-brand__logo">
                            <img src="/logo.png" alt="NESORA" />
                        </a>
                        <p className="footer-brand__tagline">
                            Create. Connect. Earn.<br />
                            The platform built for creators
                            who want more than just views.
                        </p>
                        <div className="footer-socials">

                        </div>
                    </div>

                    {/*social links */}
                    {socials.map((s) => (
                        <a
                            key={s.label}
                            href={s.url}
                            aria-label={s.label}
                            className="footer-social"
                        >{s.icon}</a>
                    ))}

                    {/* Link columns */}
                    {Object.entries(footerLinks).map(([heading, links]) => (
                        <div key={heading} className="footer-col">
                            <h4 className="footer-col__heading">{heading}</h4>
                            <ul className="footer-col__list">
                                {links.map((link) => (
                                    <li key={link.name}>
                                        <a href={link.url}>{link.name}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                </div>
            </div>

            {/* ── Bottom Bar ── */}
            <div className="footer-bottom">
                <div className="footer-bottom__inner">
                    <p className="footer-bottom__copy">
                        © {new Date().getFullYear()} NESORA. All rights reserved.
                    </p>
                    <div className="footer-bottom__cta">
                        <RedirectButton
                            className="footer-cta-btn"
                            path="/register"
                        >
                            Become a Creator
                        </RedirectButton>
                    </div>
                </div>
            </div>

        </footer >
    )
}