import { Category } from "@prisma/client"

export type CategoryMeta = {
    value: Category
    label: string
    emoji: string
}

export const CATEGORIES: CategoryMeta[] = [
    { value: "MUSIC", label: "Music", emoji: "🎵" },
    { value: "DANCE", label: "Dance", emoji: "💃" },
    { value: "COMEDY", label: "Comedy", emoji: "😂" },
    { value: "FASHION", label: "Fashion", emoji: "👗" },
    { value: "BEAUTY", label: "Beauty", emoji: "💄" },
    { value: "FITNESS", label: "Fitness", emoji: "💪" },
    { value: "FOOD", label: "Food", emoji: "🍜" },
    { value: "TRAVEL", label: "Travel", emoji: "✈️" },
    { value: "GAMING", label: "Gaming", emoji: "🎮" },
    { value: "TECH", label: "Tech", emoji: "💻" },
    { value: "ART", label: "Art", emoji: "🎨" },
    { value: "PHOTOGRAPHY", label: "Photography", emoji: "📸" },
    { value: "FILM", label: "Film", emoji: "🎬" },
    { value: "EDUCATION", label: "Education", emoji: "📚" },
    { value: "LIFESTYLE", label: "Lifestyle", emoji: "🌿" },
    { value: "SPORTS", label: "Sports", emoji: "⚽" },
    { value: "BUSINESS", label: "Business", emoji: "💼" },
    { value: "WELLNESS", label: "Wellness", emoji: "🧘" },
    { value: "PODCAST", label: "Podcast", emoji: "🎙️" },
    { value: "OTHER", label: "Other", emoji: "✨" },
]