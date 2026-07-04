"use client"

import { useEffect, useRef, useState } from "react"
import "@/styles/creator/live.scss"

const STREAM_CONFIG = "STANDARD_LANDSCAPE" as const
const VIDEO_CONSTRAINTS = { width: { ideal: 1280 }, height: { ideal: 720 } }

interface BrowserBroadcasterProps {
    ingestEndpoint: string
    streamKey: string
    onError?: (msg: string) => void
}

type Perm = "idle" | "requesting" | "granted" | "denied" | "nodevice" | "failed"

export default function BrowserBroadcaster({
    ingestEndpoint,
    streamKey,
    onError,
}: BrowserBroadcasterProps) {
    const clientRef       = useRef<any>(null)
    const cameraStreamRef = useRef<MediaStream | null>(null)
    const micStreamRef    = useRef<MediaStream | null>(null)
    const canvasRef       = useRef<HTMLCanvasElement | null>(null)
    const initedRef       = useRef(false)

    const [perm, setPerm]                 = useState<Perm>("idle")
    const [detail, setDetail]             = useState<string>("")   // human-readable failure text
    const [broadcasting, setBroadcasting] = useState(false)
    const [busy, setBusy]                 = useState(false)

    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
    const [videoId, setVideoId]           = useState("")
    const [audioId, setAudioId]           = useState("")

    const [micMuted, setMicMuted] = useState(false)
    const [camOff, setCamOff]     = useState(false)

    useEffect(() => {
        if (initedRef.current) return
        initedRef.current = true
        let cancelled = false

        async function init() {
            // 1. Load the SDK. If this throws, we must NOT hang on "requesting".
            let IVSBroadcastClient: any
            try {
                setPerm("requesting")
                const mod: any = await import("amazon-ivs-web-broadcast")
                // The package can export the client as default, named, or as the module itself.
                IVSBroadcastClient = mod.default ?? mod.IVSBroadcastClient ?? mod
                if (typeof IVSBroadcastClient?.create !== "function") {
                    console.error("IVS SDK module shape:", Object.keys(mod))
                    throw new Error("IVS Broadcast SDK loaded but create() is missing.")
                }
            } catch (err: any) {
                console.error("IVS SDK import failed:", err)
                setPerm("failed")
                setDetail(err?.message ?? "The broadcast SDK failed to load.")
                onError?.("The broadcast SDK failed to load. Check your connection and reload.")
                return
            }

            // 2. Create client + attach the preview canvas.
            try {
                const client = IVSBroadcastClient.create({
                    streamConfig: IVSBroadcastClient[STREAM_CONFIG],
                    ingestEndpoint,
                })
                clientRef.current = client
                if (canvasRef.current) client.attachPreview(canvasRef.current)
            } catch (err: any) {
                console.error("IVS client create failed:", err)
                setPerm("failed")
                setDetail(err?.message ?? "Could not initialise the broadcaster.")
                onError?.("Could not initialise the broadcaster.")
                return
            }

            // 3. One combined permission prompt for camera + mic.
            let combined: MediaStream
            try {
                combined = await navigator.mediaDevices.getUserMedia({
                    video: VIDEO_CONSTRAINTS,
                    audio: true,
                })
            } catch (err: any) {
                console.error("getUserMedia failed:", err)
                if (err?.name === "NotAllowedError")     { setPerm("denied");   setDetail("You blocked camera/mic access.") }
                else if (err?.name === "NotFoundError")  { setPerm("nodevice"); setDetail("No camera or microphone found.") }
                else                                     { setPerm("failed");   setDetail(err?.message ?? "Camera error.") }
                onError?.("Could not start your camera.")
                return
            }

            if (cancelled) { combined.getTracks().forEach((t) => t.stop()); return }

            // 4. Split into camera + mic streams and hand to the SDK.
            try {
                const camera = new MediaStream(combined.getVideoTracks())
                const mic    = new MediaStream(combined.getAudioTracks())
                cameraStreamRef.current = camera
                micStreamRef.current    = mic

                await clientRef.current.addVideoInputDevice(camera, "camera1", { index: 0 })
                await clientRef.current.addAudioInputDevice(mic, "mic1")

                const devices = await navigator.mediaDevices.enumerateDevices()
                const vids = devices.filter((d) => d.kind === "videoinput")
                const auds = devices.filter((d) => d.kind === "audioinput")
                setVideoDevices(vids)
                setAudioDevices(auds)
                setVideoId(camera.getVideoTracks()[0]?.getSettings().deviceId ?? vids[0]?.deviceId ?? "")
                setAudioId(mic.getAudioTracks()[0]?.getSettings().deviceId ?? auds[0]?.deviceId ?? "")

                setPerm("granted")
            } catch (err: any) {
                console.error("Attaching devices failed:", err)
                setPerm("failed")
                setDetail(err?.message ?? "Could not attach your camera to the broadcaster.")
                onError?.("Could not attach your camera.")
            }
        }

        init()
        return () => { cancelled = true; teardown() }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function teardown() {
        try { if (broadcasting) clientRef.current?.stopBroadcast() } catch {}
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
        micStreamRef.current?.getTracks().forEach((t) => t.stop())
        try { clientRef.current?.delete?.() } catch {}
        clientRef.current = null
    }

    async function switchCamera(deviceId: string) {
        const client = clientRef.current
        if (!client) return
        try {
            const next = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: deviceId }, ...VIDEO_CONSTRAINTS },
                audio: false,
            })
            cameraStreamRef.current?.getVideoTracks().forEach((t) => t.stop())
            client.removeVideoInputDevice("camera1")
            await client.addVideoInputDevice(next, "camera1", { index: 0 })
            cameraStreamRef.current = next
            setVideoId(deviceId); setCamOff(false)
        } catch { onError?.("Could not switch camera.") }
    }

    async function switchMic(deviceId: string) {
        const client = clientRef.current
        if (!client) return
        try {
            const next = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: { deviceId: { exact: deviceId } },
            })
            micStreamRef.current?.getAudioTracks().forEach((t) => t.stop())
            client.removeAudioInputDevice("mic1")
            await client.addAudioInputDevice(next, "mic1")
            micStreamRef.current = next
            setAudioId(deviceId); setMicMuted(false)
        } catch { onError?.("Could not switch microphone.") }
    }

    function toggleMic() {
        const track = micStreamRef.current?.getAudioTracks()[0]
        if (!track) return
        track.enabled = micMuted
        setMicMuted((m) => !m)
    }
    function toggleCam() {
        const track = cameraStreamRef.current?.getVideoTracks()[0]
        if (!track) return
        track.enabled = camOff
        setCamOff((c) => !c)
    }

    async function startBroadcast() {
        const client = clientRef.current
        if (!client) return
        setBusy(true)
        try {
            await client.startBroadcast(streamKey)
            setBroadcasting(true)
        } catch (err: any) {
            console.error("startBroadcast failed:", err)
            onError?.(err?.message ?? "Could not start broadcasting.")
        } finally { setBusy(false) }
    }
    async function stopBroadcast() {
        const client = clientRef.current
        if (!client) return
        setBusy(true)
        try {
            await client.stopBroadcast()
            setBroadcasting(false)
        } catch (err) { console.error("stopBroadcast failed:", err) }
        finally { setBusy(false) }
    }

    return (
        <div className="broadcaster">
            <div className="broadcaster__stage">
                <canvas ref={canvasRef} className="broadcaster__canvas" />
                {perm === "requesting" && <div className="broadcaster__overlay">Starting camera…</div>}
                {perm === "denied" && (
                    <div className="broadcaster__overlay">
                        Camera/mic blocked. Allow access in your browser’s site settings, then reload.
                        {detail && <span className="broadcaster__detail">{detail}</span>}
                    </div>
                )}
                {perm === "nodevice" && <div className="broadcaster__overlay">No camera or microphone found.</div>}
                {perm === "failed" && (
                    <div className="broadcaster__overlay">
                        Something went wrong starting the broadcaster.
                        {detail && <span className="broadcaster__detail">{detail}</span>}
                    </div>
                )}
                {broadcasting && <span className="broadcaster__live-dot">● LIVE</span>}
            </div>

            {perm === "granted" && (
                <>
                    <div className="broadcaster__devices">
                        <label className="broadcaster__device">
                            Camera
                            <select value={videoId} onChange={(e) => switchCamera(e.target.value)}>
                                {videoDevices.map((d) => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
                                ))}
                            </select>
                        </label>
                        <label className="broadcaster__device">
                            Microphone
                            <select value={audioId} onChange={(e) => switchMic(e.target.value)}>
                                {audioDevices.map((d) => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="broadcaster__controls">
                        <button className="broadcaster__toggle" onClick={toggleMic}>
                            {micMuted ? "Unmute mic" : "Mute mic"}
                        </button>
                        <button className="broadcaster__toggle" onClick={toggleCam}>
                            {camOff ? "Turn camera on" : "Turn camera off"}
                        </button>
                        {!broadcasting ? (
                            <button className="broadcaster__go" onClick={startBroadcast} disabled={busy}>
                                {busy ? "Starting…" : "Start broadcast"}
                            </button>
                        ) : (
                            <button className="broadcaster__stop" onClick={stopBroadcast} disabled={busy}>
                                {busy ? "Stopping…" : "Stop broadcast"}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}