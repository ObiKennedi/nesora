"use client"

import { useEffect } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import "@/styles/landing-page/AboutSection.scss"

const aboutRows = [
    {
        id: 1,
        title: "Who We Are",
        body: "Nesora is a creator-first platform built to connect talent with opportunity — a growing community where creators, fans, and industry professionals come together to discover new talent and foster a culture of creativity.",
        image: "/landing-page/about-1.jpg",
        alt: "Creators at work",
        layout: "image-left", // image left, text right
    },
    {
        id: 2,
        title: "What We Do",
        body: "We provide a platform where creators showcase their work, engage with their audience, and build thriving communities around their passions — making it easier to share content and create interactions beyond traditional social media.",
        image: "/landing-page/about-2.jpg",
        alt: "Community",
        layout: "image-right", // text left, image right
    },
    {
        id: 3,
        title: "How We Help",
        body: "We help creators grow through visibility, engagement tools, and a supportive community that values their work. For fans, we create closer connections with the creators they admire — removing barriers between talent and opportunity.",
        image: "/landing-page/about-3.jpg",
        alt: "Creativity",
        layout: "image-left",
    },
    {
        id: 4,
        title: "Our Vision",
        body: "To build the world's most empowering ecosystem for creators and their communities — where talent is not limited by geography, connections, or resources, and creativity can flourish without boundaries.",
        image: "/landing-page/about-4.jpg",
        alt: "Vision",
        layout: "image-right",
    },
]

const BrandMark = () => (
    <svg
        className="about-brandmark"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path
            d="M4 28 L16 4 L28 28"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
        <path
            d="M8 20 L24 20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        />
    </svg>
)

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
                {aboutRows.map((row, index) => (
                    <div
                        key={row.id}
                        className={`about-row about-row--${row.layout}`}
                    >
                        {/* Image */}
                        <div
                            className="about-row__image"
                            data-aos={row.layout === "image-left" ? "fade-up" : "fade-down"}
                            data-aos-delay={index * 80}
                        >
                            <img src={row.image} alt={row.alt} />
                        </div>

                        {/* Text */}
                        <div
                            className="about-row__text"
                            data-aos={row.layout === "image-left" ? "fade-down" : "fade-up"}
                            data-aos-delay={index * 80 + 100}
                        >
                            <h2 className="about-row__title">{row.title}</h2>
                            <div className="about-row__divider" aria-hidden="true" />
                            <p className="about-row__body">{row.body}</p>
                            <BrandMark />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}