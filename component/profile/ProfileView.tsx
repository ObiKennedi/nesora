import { BadgeCheck, Globe, Music2 } from "lucide-react"
import {FaInstagram, FaTwitter, FaTiktok, FaYoutube } from "react-icons/fa"
import type { getPublicCreatorProfile } from "@/lib/data/creator-profile"
import { BackButton } from "./BackButton"
import "@/styles/profile/ProfileView.scss"

import { Lock, Heart, MessageCircle, FileText, Image as ImageIcon, Video, Music, BarChart3 } from "lucide-react"

// helper — put near the top of the module
const POST_ICON: Record<string, React.ReactNode> = {
    TEXT:  <FileText  size={14} />,
    PHOTO: <ImageIcon size={14} />,
    VIDEO: <Video     size={14} />,
    AUDIO: <Music     size={14} />,
    POLL:  <BarChart3 size={14} />,
}

function formatPostDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric", month: "short", year: "numeric",
    })
}

type Profile = NonNullable<Awaited<ReturnType<typeof getPublicCreatorProfile>>>

export const ProfileView = ({ profile }: { profile: Profile }) => {
    const socials = [
        { url: profile.instagramUrl, icon: <FaInstagram size={18} />, label: "Instagram" },
        { url: profile.twitterUrl,   icon: <FaTwitter   size={18} />, label: "Twitter"   },
        { url: profile.tiktokUrl,    icon: <FaTiktok    size={18} />, label: "TikTok"    },
        { url: profile.youtubeUrl,   icon: <FaYoutube   size={18} />, label: "YouTube"   },
    ].filter((s) => s.url)

    return (
        <div
            className={`profile-view profile-view--${profile.profileTheme}`}
            style={{ "--profile-accent": profile.accentColor ?? "var(--color-primary)" } as React.CSSProperties}
        >
            {/* Sticky top bar with back button */}
            <div className="profile-view__topbar">
                <BackButton fallback="/" />
            </div>

            {/* Banner */}
            <div className="profile-view__banner">
                {profile.bannerImage && (
                    <img src={profile.bannerImage} alt="" />
                )}
            </div>

            {/* Head: avatar + identity */}
            <div className="profile-view__head">
                <img
                    className="profile-view__avatar"
                    src={profile.image ?? "/default-avatar.png"}
                    alt={profile.displayName}
                />
                <div className="profile-view__identity">
                    <h1 className="profile-view__name">
                        {profile.displayName}
                        {profile.isVerified && (
                            <BadgeCheck size={18} className="profile-view__verified" />
                        )}
                    </h1>
                    {profile.handle && (
                        <span className="profile-view__handle">@{profile.handle}</span>
                    )}
                </div>

                {profile.subscriptionEnabled && profile.subscriptionPrice != null && (
                    <a
                        href={`/profile/${profile.handle ?? profile.id}/subscribe`}
                        className="profile-view__subscribe"
                    >
                        Subscribe · ₦{profile.subscriptionPrice.toLocaleString()}/mo
                    </a>
                )}
            </div>

            {/* Bio */}
            {profile.bio && <p className="profile-view__bio">{profile.bio}</p>}

            {/* Stats */}
            <div className="profile-view__stats">
                <div className="profile-view__stat">
                    <strong>{profile.counts.followers.toLocaleString()}</strong>
                    <span>Followers</span>
                </div>
                <div className="profile-view__stat">
                    <strong>{profile.counts.subscribers.toLocaleString()}</strong>
                    <span>Subscribers</span>
                </div>
                <div className="profile-view__stat">
                    <strong>{profile.counts.posts.toLocaleString()}</strong>
                    <span>Posts</span>
                </div>
            </div>

            {/* Categories */}
            {profile.categories.length > 0 && (
                <div className="profile-view__categories">
                    {profile.categories.map((c) => (
                        <span key={c} className="profile-view__chip">
                            {c.charAt(0) + c.slice(1).toLowerCase()}
                        </span>
                    ))}
                </div>
            )}

            {/* Links */}
            {(profile.websiteUrl || socials.length > 0) && (
                <div className="profile-view__links">
                    {profile.websiteUrl && (
                        <a href={profile.websiteUrl} target="_blank" rel="noreferrer" className="profile-view__link">
                            <Globe size={18} />
                            <span>{profile.websiteUrl.replace(/^https?:\/\//, "")}</span>
                        </a>
                    )}
                    {socials.map((s) => (
                        <a key={s.label} href={s.url!} target="_blank" rel="noreferrer" className="profile-view__social" aria-label={s.label}>
                            {s.icon}
                        </a>
                    ))}
                </div>
            )}

            {/* ── Posts ── */}
<section className="profile-view__posts">
    <h2 className="profile-view__posts-title">Posts</h2>

    {profile.posts.length === 0 ? (
        <p className="profile-view__posts-empty">No posts yet.</p>
    ) : (
        <div className="profile-view__posts-grid">
            {profile.posts.map((post) => (
                <article
                    key={post.id}
                    className={`profile-post ${post.locked ? "profile-post--locked" : ""}`}
                >
                    {/* media / thumbnail */}
                    <div className="profile-post__media">
                        {post.locked ? (
                            <div className="profile-post__lock">
                                <Lock size={20} />
                                <span>Subscribers only</span>
                            </div>
                        ) : post.thumbnailUrl ? (
                            <img src={post.thumbnailUrl} alt={post.title ?? ""} />
                        ) : (
                            <div className="profile-post__placeholder">
                                {POST_ICON[post.type] ?? <FileText size={14} />}
                            </div>
                        )}
                        <span className="profile-post__type">
                            {POST_ICON[post.type]}
                            {post.type.charAt(0) + post.type.slice(1).toLowerCase()}
                        </span>
                    </div>

                    {/* body */}
                    <div className="profile-post__info">
                        {post.title && <h3 className="profile-post__title">{post.title}</h3>}
                        {post.body && <p className="profile-post__excerpt">{post.body}</p>}

                        <div className="profile-post__meta">
                            <span className="profile-post__date">{formatPostDate(post.date)}</span>
                            <span className="profile-post__stats">
                                <span><Heart size={13} /> {post.likeCount}</span>
                                <span><MessageCircle size={13} /> {post.commentCount}</span>
                            </span>
                        </div>
                    </div>
                </article>
            ))}
        </div>
    )}
</section>
        </div>
    )
}