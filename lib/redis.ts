// lib/redis.ts
import { Redis } from "@upstash/redis"

export const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// ── Key helpers ───────────────────────────────────────────────────────────────

export const redisKeys = {
    // Unread count per conversation per user
    unreadCount:     (userId: string, conversationId: string) =>
        `unread:${userId}:${conversationId}`,

    // Total unread across all conversations
    totalUnread:     (userId: string) =>
        `total_unread:${userId}`,

    // Online presence
    userOnline:      (userId: string) =>
        `online:${userId}`,

    // Typing indicator
    typing:          (conversationId: string, userId: string) =>
        `typing:${conversationId}:${userId}`,

    // Conversation list cache
    conversations:   (userId: string) =>
        `conversations:${userId}`,
}