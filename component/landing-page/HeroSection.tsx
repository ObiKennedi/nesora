"use client"

import { useEffect } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import { RedirectButton } from "../essentials/LinkButton"
import "@/styles/landing-page/HeroSection.scss"

export const HeroSection = () => {

    useEffect(() => {
        AOS.init({
            duration: 800,
            easing: "ease-out-quart",
            once: true,
        })
    }, [])

    return (
        <section className="hero-section">
            <video
                src="/landing-page/hero-bg.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="background-vid"
            />

            <div className="hero-overlay" />

            <div className="hero-content">
                <div
                    className="hero-text"
                    data-aos="fade-up"
                    data-aos-delay="100"
                >
                    <h2>The space for the real and raw</h2>
                    <p>
                        Get a glimpse into the unfiltered daily lives of
                        your favorite creators
                    </p>
                </div>

                <div
                    className="hero-actions"
                    data-aos="fade-up"
                    data-aos-delay="300"
                >
                    <RedirectButton
                        className="cta-outline"
                        path="#about"
                    >
                        Learn More
                    </RedirectButton>
                    <RedirectButton
                        className="cta-filled"
                        path="/register"
                    >
                        Get Started
                    </RedirectButton>
                </div>
            </div>
        </section>
    )
}