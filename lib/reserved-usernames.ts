export const RESERVED_USERNAMES = new Set([
    "feed",
    "shorts",
    "live",
    "messages",
    "subscriptions",
    "wallet",
    "settings",
    "onboarding",
    "creator",
    "admin",
    "fan",
    "api",
    "login",
    "register",
    "signup",
    "logout",
    "post",
    "story",
    "stories",
    "search",
    "notifications",
    "support",
    "help",
    "about",
    "terms",
    "privacy",
    "nesora",
])

export function isReservedUsername(username: string): boolean {
    return RESERVED_USERNAMES.has(username.toLowerCase())
}