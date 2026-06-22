// components/creator/analytics/ContentTab.tsx
"use client"

import {
    LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { Eye, Heart, Share2, Bookmark } from "lucide-react"
import { format } from "date-fns"

type Props = {
    data: {
        totalViews:  number
        totalLikes:  number
        totalShares: number
        totalSaves:  number
        topPosts: {
            id:           string
            title:        string | null
            type:         string
            viewCount:    number
            likeCount:    number
            commentCount: number
            shareCount:   number
            saveCount:    number
            publishedAt:  Date | null
        }[]
        monthlyEngagement: { month: string; views: number; likes: number; comments: number }[]
    }
}

const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000     ? `${(n / 1_000).toFixed(1)}k`
  : n.toString()

export const ContentTab = ({ data }: Props) => {

    const stats = [
        { label: "Total Views",  value: data.totalViews,  icon: <Eye      size={18} />, color: "blue"   },
        { label: "Total Likes",  value: data.totalLikes,  icon: <Heart    size={18} />, color: "red"    },
        { label: "Total Shares", value: data.totalShares, icon: <Share2   size={18} />, color: "green"  },
        { label: "Total Saves",  value: data.totalSaves,  icon: <Bookmark size={18} />, color: "amber"  },
    ]

    return (
        <div className="content-analytics">

            {/* ── Stats ── */}
            <div className="content-stats">
                {stats.map((s) => (
                    <div key={s.label} className="content-stat">
                        <div className={`content-stat__icon content-stat__icon--${s.color}`}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="content-stat__value">{fmt(s.value)}</p>
                            <p className="content-stat__label">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Engagement trend ── */}
            <div className="analytics-card">
                <h3 className="analytics-card__title">Engagement Trend — Last 6 Months</h3>
                <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={data.monthlyEngagement} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E0DDD9" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9A9A9A" }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E0DDD9" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="views"    name="Views"    stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="likes"    name="Likes"    stroke="#dc2626" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="comments" name="Comments" stroke="#16a34a" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* ── Top posts ── */}
            <div className="analytics-card">
                <h3 className="analytics-card__title">Top Performing Posts</h3>
                {data.topPosts.length === 0 ? (
                    <div className="analytics-card__empty">No published posts yet</div>
                ) : (
                    <div className="top-posts-list">
                        {data.topPosts.map((post, i) => (
                            <div key={post.id} className="top-post-item">
                                <span className="top-post-item__rank">{i + 1}</span>
                                <div className="top-post-item__info">
                                    <p className="top-post-item__title">
                                        {post.title || `${post.type.charAt(0)}${post.type.slice(1).toLowerCase()} post`}
                                    </p>
                                    <span className="top-post-item__date">
                                        {post.publishedAt && format(new Date(post.publishedAt), "d MMM yyyy")}
                                    </span>
                                </div>
                                <div className="top-post-item__stats">
                                    <span><Eye size={12} /> {fmt(post.viewCount)}</span>
                                    <span><Heart size={12} /> {fmt(post.likeCount)}</span>
                                    <span><Share2 size={12} /> {fmt(post.shareCount)}</span>
                                    <span><Bookmark size={12} /> {fmt(post.saveCount)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
    )
}