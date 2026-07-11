// component/messages/VoiceRecorder.tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2, Send, Loader2, Play, Pause } from "lucide-react"
import { uploadVoiceNote, type VoiceNoteUpload } from "@/lib/upload-voice-note"
import { showToast } from "@/component/fan/ui/Toast"
import "@/styles/messages/voice-recorder.scss"

// ── Why the old recorder sent empty voice notes ──────────────────────────────
// MediaRecorder.stop() is asynchronous: the final "dataavailable" event fires
// AFTER stop() returns. Building the blob synchronously after calling stop()
// produces a 0-byte blob → Cloudinary "succeeds" with an empty asset → the
// message sends with a dead URL. The fix: assemble the blob inside onstop,
// wrapped in a promise, and only then upload → then send.
// ──────────────────────────────────────────────────────────────────────────────

const MAX_DURATION_S = 120 // auto-stop at 2 minutes
const MIN_DURATION_S = 1

function getSupportedMimeType(): string {
    // Chrome / Firefox / Edge → webm+opus. Safari (macOS + iOS) → mp4/aac.
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
    ]
    for (const type of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
            return type
        }
    }
    return "" // let the browser pick its default
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
}

type RecorderState = "idle" | "recording" | "preview" | "uploading"

type VoiceRecorderProps = {
    onSend:          (upload: VoiceNoteUpload) => void | Promise<void>
    onCancel?:       () => void
    /** Fires with true when the recorder leaves idle (recording/preview/uploading)
     *  and false when it returns to idle — lets the parent collapse the rest of
     *  the input row so the recorder can fill it. */
    onActiveChange?: (active: boolean) => void
    disabled?:       boolean
}

export default function VoiceRecorder({ onSend, onCancel, onActiveChange, disabled }: VoiceRecorderProps) {
    const [state, setState]                 = useState<RecorderState>("idle")
    const [elapsed, setElapsed]             = useState(0)
    const [uploadPercent, setUploadPercent] = useState(0)
    const [isPlaying, setIsPlaying]         = useState(false)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const streamRef        = useRef<MediaStream | null>(null)
    const chunksRef        = useRef<Blob[]>([])
    const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
    const elapsedRef       = useRef(0)
    const blobRef          = useRef<Blob | null>(null)
    const previewUrlRef    = useRef<string | null>(null)
    const audioRef         = useRef<HTMLAudioElement | null>(null)

    // ── Cleanup helpers ───────────────────────────────────────────────────────

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const releaseStream = useCallback(() => {
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = null
    }, [])

    const releasePreview = useCallback(() => {
        if (previewUrlRef.current) {
            URL.revokeObjectURL(previewUrlRef.current)
            previewUrlRef.current = null
        }
        audioRef.current?.pause()
        audioRef.current = null
        setIsPlaying(false)
    }, [])

    useEffect(() => {
        onActiveChange?.(state !== "idle")
    }, [state, onActiveChange])

    useEffect(() => {
        // Unmount safety: kill mic, timer, and object URLs
        return () => {
            stopTimer()
            releaseStream()
            releasePreview()
            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop()
            }
        }
    }, [stopTimer, releaseStream, releasePreview])

    // ── Recording lifecycle ───────────────────────────────────────────────────

    const startRecording = useCallback(async () => {
        if (disabled) return

        let stream: MediaStream
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
            showToast("Microphone access is needed to record a voice note.", "error")
            return
        }

        streamRef.current = stream
        chunksRef.current = []
        blobRef.current   = null
        elapsedRef.current = 0
        setElapsed(0)

        const mimeType = getSupportedMimeType()
        const recorder = new MediaRecorder(
            stream,
            mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : { audioBitsPerSecond: 64_000 }
        )
        mediaRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
        }

        // timeslice of 1000ms → chunks flush every second, so even if the tab
        // is backgrounded mid-recording we don't lose everything.
        recorder.start(1000)
        setState("recording")

        timerRef.current = setInterval(() => {
            elapsedRef.current += 1
            setElapsed(elapsedRef.current)
            if (elapsedRef.current >= MAX_DURATION_S) {
                void finishRecording()
            }
        }, 1000)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled])

    /** Stops the recorder and resolves ONLY after the final chunk has landed. */
    const stopAndAssemble = useCallback((): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const recorder = mediaRecorderRef.current
            if (!recorder || recorder.state === "inactive") {
                reject(new Error("Recorder is not active."))
                return
            }

            recorder.onstop = () => {
                const mimeType = recorder.mimeType || "audio/webm"
                const blob     = new Blob(chunksRef.current, { type: mimeType })
                resolve(blob)
            }
            recorder.onerror = () => reject(new Error("Recording failed."))

            recorder.stop() // final dataavailable fires before onstop
        })
    }, [])

    const finishRecording = useCallback(async () => {
        stopTimer()

        if (elapsedRef.current < MIN_DURATION_S) {
            cancelRecording()
            showToast("Hold a little longer — that recording was too short.", "error")
            return
        }

        try {
            const blob = await stopAndAssemble()
            releaseStream()

            if (blob.size === 0) {
                setState("idle")
                showToast("Nothing was recorded. Please try again.", "error")
                return
            }

            blobRef.current       = blob
            previewUrlRef.current = URL.createObjectURL(blob)
            setState("preview")
        } catch {
            releaseStream()
            setState("idle")
            showToast("Recording failed. Please try again.", "error")
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopTimer, stopAndAssemble, releaseStream])

    const cancelRecording = useCallback(() => {
        stopTimer()
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.onstop = null
            mediaRecorderRef.current.stop()
        }
        releaseStream()
        releasePreview()
        chunksRef.current  = []
        blobRef.current    = null
        elapsedRef.current = 0
        setElapsed(0)
        setState("idle")
        onCancel?.()
    }, [stopTimer, releaseStream, releasePreview, onCancel])

    // ── Preview playback ──────────────────────────────────────────────────────

    const togglePlayback = useCallback(() => {
        if (!previewUrlRef.current) return

        if (!audioRef.current) {
            audioRef.current = new Audio(previewUrlRef.current)
            audioRef.current.onended = () => setIsPlaying(false)
        }

        if (isPlaying) {
            audioRef.current.pause()
            setIsPlaying(false)
        } else {
            void audioRef.current.play()
            setIsPlaying(true)
        }
    }, [isPlaying])

    // ── Upload + send ─────────────────────────────────────────────────────────

    const handleSend = useCallback(async () => {
        const blob = blobRef.current
        if (!blob) return

        setState("uploading")
        setUploadPercent(0)

        try {
            const upload = await uploadVoiceNote(blob, elapsedRef.current, setUploadPercent)
            await onSend(upload)

            releasePreview()
            blobRef.current    = null
            chunksRef.current  = []
            elapsedRef.current = 0
            setElapsed(0)
            setState("idle")
        } catch (err) {
            setState("preview") // keep the recording so they can retry
            showToast(
                err instanceof Error ? err.message : "Could not send voice note.",
                "error"
            )
        }
    }, [onSend, releasePreview])

    // ── Render ────────────────────────────────────────────────────────────────

    if (state === "idle") {
        return (
            <button
                type="button"
                className="voice-recorder__trigger"
                onClick={startRecording}
                disabled={disabled}
                aria-label="Record voice note"
            >
                <Mic size={20} />
            </button>
        )
    }

    return (
        <div className={`voice-recorder voice-recorder--${state}`}>
            {state === "recording" && (
                <>
                    <button
                        type="button"
                        className="voice-recorder__cancel"
                        onClick={cancelRecording}
                        aria-label="Discard recording"
                    >
                        <Trash2 size={18} />
                    </button>

                    <div className="voice-recorder__status">
                        <span className="voice-recorder__pulse" aria-hidden="true" />
                        <span className="voice-recorder__time">{formatTime(elapsed)}</span>
                        <span className="voice-recorder__hint">Recording…</span>
                    </div>

                    <button
                        type="button"
                        className="voice-recorder__stop"
                        onClick={finishRecording}
                        aria-label="Stop recording"
                    >
                        <Square size={16} />
                    </button>
                </>
            )}

            {state === "preview" && (
                <>
                    <button
                        type="button"
                        className="voice-recorder__cancel"
                        onClick={cancelRecording}
                        aria-label="Discard recording"
                    >
                        <Trash2 size={18} />
                    </button>

                    <button
                        type="button"
                        className="voice-recorder__play"
                        onClick={togglePlayback}
                        aria-label={isPlaying ? "Pause preview" : "Play preview"}
                    >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>

                    <span className="voice-recorder__time">{formatTime(elapsed)}</span>

                    <button
                        type="button"
                        className="voice-recorder__send"
                        onClick={handleSend}
                        aria-label="Send voice note"
                    >
                        <Send size={18} />
                    </button>
                </>
            )}

            {state === "uploading" && (
                <div className="voice-recorder__uploading">
                    <Loader2 size={18} className="voice-recorder__spinner" />
                    <span>Sending… {uploadPercent}%</span>
                    <div className="voice-recorder__progress">
                        <div
                            className="voice-recorder__progress-bar"
                            style={{ width: `${uploadPercent}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}