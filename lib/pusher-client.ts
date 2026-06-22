// lib/pusher-client.ts  ← client side
import PusherClient from "pusher-js"

let pusherInstance: PusherClient | null = null

export const getPusherClient = () => {
    if (pusherInstance) return pusherInstance

    pusherInstance = new PusherClient(
        process.env.NEXT_PUBLIC_PUSHER_KEY!,
        {
            cluster:          process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
            authEndpoint:     "/api/pusher/auth",
            authTransport:    "ajax",
        }
    )

    return pusherInstance
}