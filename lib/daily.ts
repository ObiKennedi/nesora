const DAILY_API_BASE = "https://api.daily.co/v1"

const ROOM_TTL_SECONDS = 4 * 60 * 60

export class DailyApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
    ) {
        super(message)
        this.name = "DailyApiError"
    }
}

async function dailyFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const apiKey = process.env.DAILY_API_KEY
    if (!apiKey) throw new Error("DAILY_API_KEY is not set")

    const res = await fetch(`${DAILY_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization:  `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...init?.headers,
        },
        cache: "no-store",
    })

    if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new DailyApiError(
            res.status,
            `Daily API ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 300)}`,
        )
    }

    return res.json() as Promise<T>
}

export type DailyRoom = {
    id:   string
    name: string
    url:  string
}

export async function createCallRoom(params: {
    roomName: string
    callType: "VOICE" | "VIDEO"
}): Promise<DailyRoom> {
    const now = Math.floor(Date.now() / 1000)

    return dailyFetch<DailyRoom>("/rooms", {
        method: "POST",
        body: JSON.stringify({
            name:    params.roomName,
            privacy: "private",
            properties: {
                exp:                now + ROOM_TTL_SECONDS,
                eject_at_room_exp:  true,
                max_participants:   2,
                enable_screenshare: false,
                enable_chat:        false, 
                enable_knocking:    false,
                start_video_off:    params.callType === "VOICE",
                start_audio_off:    false,
            },
        }),
    })
}

export async function deleteRoom(roomName: string): Promise<void> {
    try {
        await dailyFetch(`/rooms/${encodeURIComponent(roomName)}`, { method: "DELETE" })
    } catch (err) {
        if (err instanceof DailyApiError && err.status === 404) return
        throw err
    }
}

export function generateCallRoomName(): string {
    return `call-${crypto.randomUUID()}`
}

export async function createMeetingToken(params: {
    roomName: string
    userId:   string
    userName: string
    isOwner?: boolean
}): Promise<string> {
    const now = Math.floor(Date.now() / 1000)

    const res = await dailyFetch<{ token: string }>("/meeting-tokens", {
        method: "POST",
        body: JSON.stringify({
            properties: {
                room_name: params.roomName,
                user_id:   params.userId,
                user_name: params.userName,
                is_owner:  params.isOwner ?? false,
                exp:       now + ROOM_TTL_SECONDS,
            },
        }),
    })

    return res.token
}

export type RoomPresence = {
    total_count: number
}

export async function getRoomPresence(roomName: string): Promise<RoomPresence> {
    return dailyFetch<RoomPresence>(`/rooms/${encodeURIComponent(roomName)}/presence`)
}

export type DailyMeetingSession = {
    id:         string
    room:       string
    start_time: number 
    duration:   number 
    ongoing:    boolean
}

export async function getLatestMeetingSession(
    roomName: string,
): Promise<DailyMeetingSession | null> {
    const res = await dailyFetch<{ data: DailyMeetingSession[] }>(
        `/meetings?room=${encodeURIComponent(roomName)}&limit=1`,
    )
    return res.data[0] ?? null
}