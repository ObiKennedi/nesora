"use client"

import { useEffect, useRef, useState } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import {
    Send,
    Mail,
    User,
    MessageSquare,
    CheckCircle,
    AlertCircle,
    Loader2,
} from "lucide-react"
import "@/styles/landing-page/ContactSection.scss"

type FormState = "idle" | "loading" | "success" | "error"

interface FormData {
    name: string
    email: string
    subject: string
    message: string
}

export const ContactSection = () => {

    const [formData, setFormData] = useState<FormData>({
        name: "",
        email: "",
        subject: "",
        message: "",
    })
    const [formState, setFormState] = useState<FormState>("idle")
    const formRef = useRef<HTMLFormElement>(null)

    useEffect(() => {
        AOS.init({ duration: 800, easing: "ease-out-quart", once: true })
    }, [])

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFormState("loading")

        try {
            const res = await fetch("https://api.web3forms.com/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    access_key: process.env.NEXT_PUBLIC_WEB3FORMS_KEY,
                    ...formData,
                }),
            })

            const data = await res.json()

            if (data.success) {
                setFormState("success")
                setFormData({ name: "", email: "", subject: "", message: "" })
                setTimeout(() => setFormState("idle"), 5000)
            } else {
                setFormState("error")
                setTimeout(() => setFormState("idle"), 4000)
            }
        } catch {
            setFormState("error")
            setTimeout(() => setFormState("idle"), 4000)
        }
    }

    return (
        <section className="contact-section" id="help">
            <div className="contact-inner">

                {/* ── Left ── */}
                <div
                    className="contact-left"
                    data-aos="fade-up"
                >
                    <span className="contact-eyebrow">Get In Touch</span>
                    <h2>
                        Have questions?<br />
                        <em>We'd love to hear from you.</em>
                    </h2>
                    <p>
                        Whether you're a creator with questions about the platform,
                        a fan wanting to learn more, or a partner interested in
                        working with NESORA — we're here.
                    </p>

                    <div className="contact-info">
                        <a
                            href="mailto:hello@nesora.org"
                            className="contact-info__item"
                        >
                            <Mail size={16} />
                            <span>hello@nesora.com</span>
                        </a>
                    </div>

                    {/* Decorative block */}
                    <div className="contact-deco">
                        <div className="contact-deco__dot" />
                        <div className="contact-deco__dot contact-deco__dot--mid" />
                        <div className="contact-deco__dot contact-deco__dot--sm" />
                    </div>
                </div>

                {/* ── Right: Form ── */}
                <div
                    className="contact-right"
                    data-aos="fade-up"
                    data-aos-delay="150"
                >
                    <form
                        ref={formRef}
                        onSubmit={handleSubmit}
                        className="contact-form"
                        noValidate
                    >
                        {/* Row: Name + Email */}
                        <div className="contact-form__row">
                            <div className="form-field">
                                <label htmlFor="name">
                                    <User size={13} />
                                    Full Name
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    placeholder="Your name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    disabled={formState === "loading"}
                                />
                            </div>
                            <div className="form-field">
                                <label htmlFor="email">
                                    <Mail size={13} />
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    disabled={formState === "loading"}
                                />
                            </div>
                        </div>

                        {/* Subject */}
                        <div className="form-field">
                            <label htmlFor="subject">
                                <MessageSquare size={13} />
                                Subject
                            </label>
                            <select
                                id="subject"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                required
                                disabled={formState === "loading"}
                            >
                                <option value="" disabled>Select a topic</option>
                                <option value="Creator Inquiry">Creator Inquiry</option>
                                <option value="Fan Support">Fan Support</option>
                                <option value="Partnership">Partnership</option>
                                <option value="Press & Media">Press & Media</option>
                                <option value="Technical Issue">Technical Issue</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* Message */}
                        <div className="form-field">
                            <label htmlFor="message">
                                <MessageSquare size={13} />
                                Message
                            </label>
                            <textarea
                                id="message"
                                name="message"
                                placeholder="Tell us what's on your mind…"
                                rows={5}
                                value={formData.message}
                                onChange={handleChange}
                                required
                                disabled={formState === "loading"}
                            />
                        </div>

                        {/* Feedback */}
                        {formState === "success" && (
                            <div className="form-feedback form-feedback--success">
                                <CheckCircle size={16} />
                                <span>Message sent! We'll get back to you soon.</span>
                            </div>
                        )}

                        {formState === "error" && (
                            <div className="form-feedback form-feedback--error">
                                <AlertCircle size={16} />
                                <span>Something went wrong. Please try again.</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            className="contact-submit"
                            disabled={formState === "loading" || formState === "success"}
                        >
                            {formState === "loading" ? (
                                <>
                                    <Loader2 size={16} className="spin" />
                                    Sending…
                                </>
                            ) : formState === "success" ? (
                                <>
                                    <CheckCircle size={16} />
                                    Sent
                                </>
                            ) : (
                                <>
                                    <Send size={16} />
                                    Send Message
                                </>
                            )}
                        </button>
                    </form>
                </div>

            </div>
        </section >
    )
}