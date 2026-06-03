"use client"

import { useEffect } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import {
    DollarSign,
    Video,
    MessageCircle,
    Lock,
    BarChart2,
    BadgeCheck,
    ArrowDown,
} from "lucide-react"
import { RedirectButton } from "../essentials/LinkButton"
import "@/styles/landing-page/CreatorsSection.scss"

const benefits = [
    {
        id: 1,
        icon: <DollarSign size={20} />,
        title: "Monetize Your Creativity",
        body: "Earn through subscriptions, tips, exclusive content, and live events — all from a single platform.",
        delay: 0,
    },
    {
        id: 2,
        icon: <Video size={20} />,
        title: "Stream Live",
        body: "Host live video sessions, performances, workshops, and Q&As while interacting with your audience in real time.",
        delay: 80,
    },
    {
        id: 3,
        icon: <MessageCircle size={20} />,
        title: "Connect Directly",
        body: "Build stronger relationships through private chats, community spaces, and subscriber-only interactions.",
        delay: 160,
    },
    {
        id: 4,
        icon: <Lock size={20} />,
        title: "Share Exclusive Content",
        body: "Reward your most loyal supporters with premium posts, behind-the-scenes content, and early access releases.",
        delay: 0,
    },
    {
        id: 5,
        icon: <BarChart2 size={20} />,
        title: "Understand Your Audience",
        body: "Track growth, engagement, revenue, and content performance with creator-focused analytics.",
        delay: 80,
    },
    {
        id: 6,
        icon: <BadgeCheck size={20} />,
        title: "Creator Verification",
        body: "Verified creator profiles help establish trust, authenticity, and confidence among fans and supporters.",
        delay: 160,
    },
]

const steps = [
    "Create Account",
    "Verify Identity",
    "Build Your Profile",
    "Grow Your Community",
    "Monetize Your Audience",
]

export const CreatorsSection = () => {

    useEffect(() => {
        AOS.init({ duration: 800, easing: "ease-out-quart", once: true })
    }, [])

    return (
        <section className="creators-section" id="creators">

            {/* ── Top Eyebrow ── */}
            <div className="creators-inner">
                <div
                    className="creators-header"
                    data-aos="fade-up"
                >
                    <span className="creators-eyebrow">For Creators</span>
                    <h2>
                        Built for Creators Who Want<br />
                        <em>More Than Just Views</em>
                    </h2>
                    <p>
                        Turn your audience into a community, your content into income,
                        and your passion into a sustainable career.
                    </p>
                </div>

                {/* ── Aspirational Tagline ── */}
                <div
                    className="creators-tagline"
                    data-aos="fade-up"
                    data-aos-delay="100"
                >
                    <div className="tagline-words">
                        <span>Create.</span>
                        <span>Connect.</span>
                        <span>Earn.</span>
                    </div>
                    <p>
                        NESORA gives creators the tools to grow an audience, build a community,
                        and earn from what they love doing. No gatekeepers. No unnecessary barriers.
                        Just your creativity and the people who believe in it.
                    </p>
                </div>

                {/* ── Benefits Grid ── */}
                <div className="creators-benefits">
                    {benefits.map((b) => (
                        <div
                            key={b.id}
                            className="benefit-card"
                            data-aos="fade-up"
                            data-aos-delay={b.delay}
                        >
                            <div className="benefit-card__icon">{b.icon}</div>
                            <h3>{b.title}</h3>
                            <p>{b.body}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── How It Works ── */}
            <div className="how-it-works" data-aos="fade-up">
                <div className="creators-inner">
                    <h3 className="how-it-works__heading">How It Works</h3>
                    <div className="how-it-works__steps">
                        {steps.map((step, i) => (
                            <div key={i} className="how-step">
                                <div className="how-step__bubble">
                                    <span className="how-step__num">{i + 1}</span>
                                    <span className="how-step__label">{step}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className="how-step__arrow">
                                        <ArrowDown size={16} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Featured Creators Placeholder ── */}
            <div className="creators-inner">
                <div
                    className="featured-placeholder"
                    data-aos="fade-up"
                >
                    <div className="featured-placeholder__inner">
                        <span className="featured-placeholder__badge">Coming Soon</span>
                        <h3>Featured Creators</h3>
                        <p>
                            Once the platform launches, discover verified creators across
                            music, film, dance, writing, design, and more — right here.
                        </p>
                        <div className="featured-placeholder__avatars">
                            {["M", "A", "J", "S", "K", "R"].map((l, i) => (
                                <span
                                    key={i}
                                    className="placeholder-avatar"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                >
                                    {l}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Creator CTA ── */}
                <div
                    className="creators-cta"
                    data-aos="fade-up"
                    data-aos-delay="100"
                >
                    <div className="creators-cta__text">
                        <h2>Ready to Build Your<br />Creative Empire?</h2>
                        <p>
                            Join musicians, producers, dancers, actors, writers, designers,
                            and digital creators building meaningful communities on NESORA.
                        </p>
                    </div>
                    <RedirectButton
                        className="cta-creator"
                        path="/register"
                    >
                        Become a Creator
                    </RedirectButton>
                </div>
            </div>

        </section>
    )
}