"use client"

import { useEffect, useState } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import { Plus, Minus } from "lucide-react"
import "@/styles/landing-page/FAQSection.scss"

const faqs = [
    {
        id: 1,
        question: "What is NESORA and who is it for?",
        answer: "NESORA is a creator-first platform built for artists, musicians, dancers, writers, producers, and digital creators who want to build real communities around their work. Whether you're just starting out or already have an established audience, NESORA gives you the tools to connect, earn, and grow — all in one place.",
    },
    {
        id: 2,
        question: "How do creators earn money on NESORA?",
        answer: "Creators can earn through multiple streams — fan subscriptions, tips and direct support, pay-per-view exclusive content, live event tickets, and community memberships. Everything is managed from a single dashboard, so you always know exactly where your income is coming from.",
    },
    {
        id: 3,
        question: "Is NESORA free to join?",
        answer: "Yes — signing up as a fan or creator is completely free. Creators can set up their profile, start building their community, and access core tools at no cost. Premium creator features and monetization tools are available as your audience grows.",
    },
    {
        id: 4,
        question: "How does creator verification work?",
        answer: "After setting up your profile, creators can apply for verification by submitting identity and content credentials. Verified creators receive a badge that signals authenticity and trust to fans, helping you grow your audience faster and access advanced platform features.",
    },
    {
        id: 5,
        question: "Can fans interact directly with creators?",
        answer: "Absolutely. NESORA is built around direct connection. Fans can engage through private chats, community spaces, live streams, polls, and subscriber-only content. Creators choose exactly how they want to interact and what level of access different supporters receive.",
    },
]

const FAQItem = ({
    faq,
    isOpen,
    onToggle,
    delay,
}: {
    faq: typeof faqs[0]
    isOpen: boolean
    onToggle: () => void
    delay: number
}) => (
    <div
        className={`faq-item ${isOpen ? "faq-item--open" : ""}`}
        data-aos="fade-up"
        data-aos-delay={delay}
        onClick={onToggle}
        id="faq"
    >
        <div className="faq-item__header">
            <span className="faq-item__question">{faq.question}</span>
            <span className="faq-item__icon">
                {isOpen ? <Minus size={16} /> : <Plus size={16} />}
            </span>
        </div>
        <div className="faq-item__body">
            <p>{faq.answer}</p>
        </div>
    </div>
)

export const FAQSection = () => {

    const [openId, setOpenId] = useState<number | null>(1)

    useEffect(() => {
        AOS.init({ duration: 800, easing: "ease-out-quart", once: true })
    }, [])

    const handleToggle = (id: number) => {
        setOpenId(openId === id ? null : id)
    }

    // Split into two columns — left heading + first item, right gets the rest
    const featuredFaq = faqs[0]
    const restFaqs = faqs.slice(1)

    return (
        <section className="faq-section" id="faq">
            <div className="faq-inner">

                {/* ── Left Panel ── */}
                <div
                    className="faq-left"
                    data-aos="fade-up"
                >
                    <div className="faq-left__text">
                        <span className="faq-eyebrow">FAQ</span>
                        <h2>Frequently Asked Questions</h2>
                        <p>
                            Trusted by more than five hundred creators and a
                            million subscribers.
                        </p>
                    </div>

                    {/* Featured open item on the left */}
                    <FAQItem
                        faq={featuredFaq}
                        isOpen={openId === featuredFaq.id}
                        onToggle={() => handleToggle(featuredFaq.id)}
                        delay={100}
                    />
                </div>

                {/* ── Right Panel ── */}
                <div className="faq-right">
                    {restFaqs.map((faq, i) => (
                        <FAQItem
                            key={faq.id}
                            faq={faq}
                            isOpen={openId === faq.id}
                            onToggle={() => handleToggle(faq.id)}
                            delay={i * 80}
                        />
                    ))}
                </div>

            </div>
        </section>
    )
}