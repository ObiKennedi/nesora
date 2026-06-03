"use client"

import { JSX, useEffect } from "react"
import AOS from "aos"
import "aos/dist/aos.css"
import { Lock, Video, Users } from "lucide-react"
import { IoChatbubblesOutline } from "react-icons/io5"
import "@/styles/landing-page/FeaturesSection.scss"

const features = [
    {
        id: 1,
        icon: <IoChatbubblesOutline size={22} />,
        title: "Private Chats",
        body: "Secure direct messaging between creators and fans. Creators can build deeper relationships with their audience through one-on-one conversations, media sharing, voice notes, and subscriber-only messaging.",
        visual: "chat",
        aos: "fade-up",
        aosDelay: 0,
    },
    {
        id: 2,
        icon: <Video size={22} />,
        title: "Live Video Streams",
        body: "Go live and connect with your audience in real time. Host livestreams, answer questions, perform, teach, or interact with fans while receiving comments, reactions, and live support.",
        visual: "live",
        aos: "fade-up",
        aosDelay: 100,
    },
    {
        id: 3,
        icon: <Lock size={22} />,
        title: "Exclusive Content",
        body: "Share premium content with your most dedicated supporters. Lock posts, videos, photos, and special updates behind subscriptions, memberships, or one-time purchases.",
        visual: "exclusive",
        aos: "fade-up",
        aosDelay: 0,
    },
    {
        id: 4,
        icon: <Users size={22} />,
        title: "Creator Communities",
        body: "Build thriving communities around your content. Create dedicated spaces where fans interact, vote in polls, access announcements, and connect with other supporters.",
        visual: "community",
        aos: "fade-up",
        aosDelay: 100,
    },
]

// ── Visual Mockups ────────────────────────────────────────────────────────────

const ChatVisual = () => (
    <div className="feature-visual feature-visual--chat">
        <div className="chat-bubble chat-bubble--in">
            <span className="chat-avatar" />
            <p>Hey! Love your latest post 🔥</p>
        </div>
        <div className="chat-bubble chat-bubble--out">
            <p>Thank you so much! More coming soon 🎉</p>
            <span className="chat-avatar chat-avatar--creator" />
        </div>
        <div className="chat-bubble chat-bubble--in">
            <span className="chat-avatar" />
            <p>Can't wait — already subscribed!</p>
        </div>
        <div className="chat-input-mock">
            <span>Type a message…</span>
            <div className="chat-send" />
        </div>
    </div>
)

const LiveVisual = () => (
    <div className="feature-visual feature-visual--live">
        <div className="live-screen">
            <span className="live-badge">● LIVE</span>
            <div className="live-reactions">
                <span>❤️</span>
                <span>🔥</span>
                <span>🎉</span>
            </div>
            <div className="live-viewers">1.2k watching</div>
        </div>
        <div className="live-comments">
            <div className="live-comment"><b>@mia</b> this is amazing!!</div>
            <div className="live-comment"><b>@james</b> 🔥🔥🔥</div>
            <div className="live-comment"><b>@sara</b> first time watching, love it</div>
        </div>
    </div>
)

const ExclusiveVisual = () => (
    <div className="feature-visual feature-visual--exclusive">
        <div className="excl-post excl-post--unlocked">
            <div className="excl-thumbnail" />
            <div className="excl-meta">
                <span className="excl-tag excl-tag--free">Free</span>
                <p>Behind the scenes — studio day</p>
            </div>
        </div>
        <div className="excl-post excl-post--locked">
            <div className="excl-thumbnail excl-thumbnail--blur">
                <Lock size={18} />
            </div>
            <div className="excl-meta">
                <span className="excl-tag excl-tag--premium">Subscribers only</span>
                <p>Full unedited vlog drop</p>
            </div>
        </div>
        <div className="excl-post excl-post--locked">
            <div className="excl-thumbnail excl-thumbnail--blur">
                <Lock size={18} />
            </div>
            <div className="excl-meta">
                <span className="excl-tag excl-tag--premium">Members only</span>
                <p>Monthly Q&amp;A session</p>
            </div>
        </div>
    </div>
)

const CommunityVisual = () => (
    <div className="feature-visual feature-visual--community">
        <div className="comm-poll">
            <p className="comm-poll__q">What content do you want next?</p>
            <div className="comm-poll__option">
                <span className="comm-poll__label">Travel Vlog</span>
                <div className="comm-poll__bar">
                    <div className="comm-poll__fill" style={{ width: "72%" }} />
                </div>
                <span className="comm-poll__pct">72%</span>
            </div>
            <div className="comm-poll__option">
                <span className="comm-poll__label">Studio Session</span>
                <div className="comm-poll__bar">
                    <div className="comm-poll__fill" style={{ width: "28%" }} />
                </div>
                <span className="comm-poll__pct">28%</span>
            </div>
        </div>
        <div className="comm-members">
            {["A", "B", "C", "D", "E"].map((l) => (
                <span key={l} className="comm-avatar">{l}</span>
            ))}
            <span className="comm-count">+840 members</span>
        </div>
    </div>
)

const visuals: Record<string, JSX.Element> = {
    chat: <ChatVisual />,
    live: <LiveVisual />,
    exclusive: <ExclusiveVisual />,
    community: <CommunityVisual />,
}

export const FeaturesSection = () => {

    useEffect(() => {
        AOS.init({ duration: 800, easing: "ease-out-quart", once: true })
    }, [])

    return (
        <section className="features-section" id="features">
            <div className="features-inner">

                <div
                    className="features-header"
                    data-aos="fade-up"
                >
                    <h2>Everything creators need</h2>
                    <p>
                        Nesora gives you the tools to connect, earn, and grow —
                        all in one place.
                    </p>
                </div>

                <div className="features-grid">
                    {features.map((f) => (
                        <div
                            key={f.id}
                            className="feature-card"
                            data-aos={f.aos}
                            data-aos-delay={f.aosDelay}
                        >
                            <div className="feature-card__visual">
                                {visuals[f.visual]}
                            </div>
                            <div className="feature-card__body">
                                <div className="feature-card__icon">
                                    {f.icon}
                                </div>
                                <h3>{f.title}</h3>
                                <p>{f.body}</p>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </section>
    )
}