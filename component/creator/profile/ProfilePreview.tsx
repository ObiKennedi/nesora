// components/creator/profile/ProfilePreview.tsx
import {
     Globe, ExternalLink,
} from "lucide-react"
import { FaInstagram, FaTiktok, FaYoutube } from "react-icons/fa"
import { FaXTwitter } from "react-icons/fa6"
import "@/styles/creator/profile/ProfilePreview.scss"

type Props = {
    creator: {
        displayName:  string
        handle:       string | null
        bio:          string | null
        bannerImage:  string | null
        websiteUrl:   string | null
        links:        string[]
        instagramUrl: string | null
        twitterUrl:   string | null
        tiktokUrl:    string | null
        youtubeUrl:   string | null
        accentColor:  string | null
        profileTheme: string
        isVerified:   boolean
        _count: {
            followers:   number
            subscribers: number
            posts:       number
        }
    }
    user: {
        image:     string | null
        firstName: string | null
    } | null
}

const fmt = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()

export const ProfilePreview = ({ creator, user }: Props) => {

    const accent = creator.accentColor ?? "#c2622a"
    const isDark = creator.profileTheme === "dark"

    const socials = [
        { url: creator.instagramUrl, icon: <FaInstagram size={15} /> },
        { url: creator.twitterUrl,   icon: <FaXTwitter  size={15} /> },
        { url: creator.tiktokUrl,    icon: <FaTiktok    size={15} /> },
        { url: creator.youtubeUrl,   icon: <FaYoutube   size={15} /> },
    ].filter((s) => !!s.url)

    return (
        <div className="profile-preview-wrap">
            <p className="profile-preview-label">Live Preview</p>

            <div
                className={`profile-preview ${isDark ? "profile-preview--dark" : ""}`}
                style={{ "--preview-accent": accent } as any}
            >

                {/* Banner */}
                <div
                    className="profile-preview__banner"
                    style={{
                        backgroundImage: creator.bannerImage ? `url(${creator.bannerImage})` : undefined,
                        backgroundColor: creator.bannerImage ? undefined : accent + "33",
                    }}
                />

                {/* Avatar */}
                <div className="profile-preview__avatar-wrap">
                    <div
                        className="profile-preview__avatar"
                        style={{ borderColor: accent }}
                    >
                        {user?.image ? (
                            <img src={user.image} alt={creator.displayName} />
                        ) : (
                            <span>{creator.displayName.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    {creator.isVerified && (
                        <span className="profile-preview__verified" style={{ backgroundColor: accent }}>✓</span>
                    )}
                </div>

                {/* Info */}
                <div className="profile-preview__info">
                    <h4 className="profile-preview__name">{creator.displayName}</h4>
                    {creator.handle && (
                        <p className="profile-preview__handle">@{creator.handle}</p>
                    )}

                    {/* Stats */}
                    <div className="profile-preview__stats">
                        <div>
                            <strong>{fmt(creator._count.followers)}</strong>
                            <span>Followers</span>
                        </div>
                        <div>
                            <strong>{fmt(creator._count.subscribers)}</strong>
                            <span>Subscribers</span>
                        </div>
                        <div>
                            <strong>{fmt(creator._count.posts)}</strong>
                            <span>Posts</span>
                        </div>
                    </div>

                    {creator.bio && (
                        <p className="profile-preview__bio">{creator.bio}</p>
                    )}

                    {/* Social icons */}
                    {socials.length > 0 && (
                        <div className="profile-preview__socials">
                            {socials.map((s, i) => (
                                <a
                                    key={i}
                                    href={s.url!}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="profile-preview__social-icon"
                                    style={{ color: accent }}
                                >
                                    {s.icon}
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Subscribe button (preview) */}
                    <button
                        className="profile-preview__subscribe-btn"
                        style={{ backgroundColor: accent }}
                    >
                        Subscribe
                    </button>

                </div>

            </div>
        </div>
    )
}