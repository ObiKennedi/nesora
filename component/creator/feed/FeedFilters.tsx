// components/creator/feed/FeedFilters.tsx
"use client"

import { PostStatus, PostType } from "@prisma/client"
import "@/styles/creator/feed/FeedFilters.scss"

type Props = {
    status: PostStatus | "ALL"
    type: PostType | "ALL"
    onStatus: (s: PostStatus | "ALL") => void
    onType: (t: PostType | "ALL") => void
}

const STATUSES: { value: PostStatus | "ALL"; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "PUBLISHED", label: "Published" },
    { value: "DRAFT", label: "Drafts" },
    { value: "SCHEDULED", label: "Scheduled" },
]

const TYPES: { value: PostType | "ALL"; label: string }[] = [
    { value: "ALL", label: "All Types" },
    { value: "TEXT", label: "Text" },
    { value: "PHOTO", label: "Photo" },
    { value: "VIDEO", label: "Video" },
    { value: "AUDIO", label: "Audio" },
    { value: "POLL", label: "Poll" },
]

export const FeedFilters = ({ status, type, onStatus, onType }: Props) => {
    return (
        <div className="feed-filters">
            <div className="feed-filters__group">
                {STATUSES.map((s) => (
                    <button
                        key={s.value}
                        className={`feed-filter-btn ${status === s.value ? "feed-filter-btn--active" : ""}`}
                        onClick={() => onStatus(s.value as PostStatus | "ALL")}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <select
                className="feed-filter-select"
                value={type}
                onChange={(e) => onType(e.target.value as PostType | "ALL")}
            >
                {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                ))}
            </select>
        </div>
    )
}