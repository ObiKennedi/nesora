"use client"

import { useEffect } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import { RedirectButton } from "../essentials/LinkButton"
import "@/styles/landing-page/AboutSection.scss"

const aboutItems = [
    {
        id: 1,
        number: "1.",
        title: "Who We Are",
        body: "Nesora is a creator-first platform built to connect talent with opportunity — a growing community where creators, fans, and industry professionals come together to discover new talent and foster a culture of creativity.",
    },
    {
        id: 2,
        number: "2.",
        title: "What We Do",
        body: "We provide a platform where creators showcase their work, engage with their audience, and build thriving communities around their passions — making it easier to share content and create interactions beyond traditional social media.",
    },
    {
        id: 3,
        number: "3.",
        title: "How We Help",
        body: "We help creators grow through visibility, engagement tools, and a supportive community that values their work. For fans, we create closer connections with the creators they admire — removing barriers between talent and opportunity.",
    },
    {
        id: 4,
        number: "4.",
        title: "Our Vision",
        body: "To build the world's most empowering ecosystem for creators and their communities — where talent is not limited by geography, connections, or resources, and creativity can flourish without boundaries.",
    },
]

export const AboutSection = () => {

    useEffect(() => {
        AOS.init({
            duration: 800,
            easing: "ease-out-quart",
            once: true,
        })
    }, [])

    return (
        <section className="about-section" id="about">
            <div className="about-inner">

                {/* ── Header Row ── */}
                <div className="about-header">
                    <div
                        className="about-header__left"
                        data-aos="fade-up"
                        data-aos-delay="0"
                    >
                        <h2>About Us</h2>
                        <p>
                            At Nesora, we take pride in our values —
                            service, integrity, and excellence.
                        </p>
                    </div>

                    <div
                        className="about-header__right"
                        data-aos="fade-up"
                        data-aos-delay="150"
                    >
                        <RedirectButton
                            className="about-learn-more"
                            path="#features"
                        >
                            Learn More
                        </RedirectButton>
                    </div>
                </div>

                {/* ── Body: Grid + Images ── */}
                <div className="about-body">

                    {/* Items Grid */}
                    <div className="about-grid">
                        {aboutItems.map((item, index) => (
                            <div
                                className="about-card"
                                key={item.id}
                                data-aos="fade-up"
                                data-aos-delay={index * 100}
                            >
                                <span className="about-card__number">
                                    {item.number}
                                </span>
                                <h3 className="about-card__title">
                                    {item.title}
                                </h3>
                                <p className="about-card__body">
                                    {item.body}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Image Mosaic */}
                    <div
                        className="about-mosaic"
                        data-aos="fade-down"
                        data-aos-delay="200"
                    >
                        <div className="mosaic-img mosaic-img--tall">
                            <img src="/landing-page/about1.jpg" alt="Creators at work" />
                        </div>
                        <div className="mosaic-img mosaic-img--short">
                            <img src="/landing-page/about2.jpg" alt="Community" />
                        </div>
                        <div className="mosaic-img mosaic-img--short">
                            <img src="/landing-page/about-3.jpg" alt="Creativity" />
                        </div>
                        <div className="mosaic-img mosaic-img--short">
                            <img src="/landing-page/about4.jpg" alt="Vision" />
                        </div>
                    </div>

                </div>
            </div>
        </section>
    )
}