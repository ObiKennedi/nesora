// components/creator/feed/StoryComposer.tsx
"use client"

import { useState, useRef, useTransition } from "react"
import {
    X, ImageIcon, Video, Type, Loader2, Eye,
} from "lucide-react"
import { PostAccessLevel } from "@prisma/client"
import { createStoryAction } from "@/actions/stories"
import { TEXT_CARD_BACKGROUNDS, TEXT_CARD_FONTS } from "@/lib/story-constants"
import { uploadToCloudinaryWithId } from "@/lib/cloudinary-client"
import { AccessPicker } from "./AccessPicker"
import "@/styles/creator/feed/StoryComposer.scss"

type StoryMode = "PHOTO" | "VIDEO" | "TEXT_CARD"

const MODES = [
    { mode: "PHOTO"     as StoryMode, label: "Photo", icon: <ImageIcon size={16} /> },
    { mode: "VIDEO"     as StoryMode, label: "Video", icon: <Video     size={16} /> },
    { mode: "TEXT_CARD" as StoryMode, label: "Text",  icon: <Type      size={16} /> },
]

const MAX_VIDEO_SECONDS = 60

const FONT_LABELS: Record<string, string> = {
    classic: "Classic",
    bold:    "Bold",
    mono:    "Mono",
}

function probeDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const el  = document.createElement("video")
        const src = URL.createObjectURL(file)
        const cleanup = () => { URL.revokeObjectURL(src); el.removeAttribute("src"); el.load() }
        const timer = setTimeout(() => { cleanup(); reject(new Error("Probe timed out")) }, 8_000)
        el.preload = "metadata"
        el.muted   = true
        el.onloadedmetadata = () => {
            clearTimeout(timer)
            const secs = isFinite(el.duration) ? Math.round(el.duration) : 0
            cleanup()
            resolve(secs)
        }
        el.onerror = () => { clearTimeout(timer); cleanup(); reject(new Error("Cannot read metadata")) }
        el.src = src
    })
}

type Props = {
    onClose:   () => void
    onSuccess: () => void
}

export function StoryComposer({ onClose, onSuccess }: Props) {
    const [mode, setMode] = useState<StoryMode>("PHOTO")

    // Media state
    const [preview,   setPreview]   = useState<string | null>(null)
    const [uploaded,  setUploaded]  = useState<{ url: string; publicId: string } | null>(null)
    const [duration,  setDuration]  = useState<number | null>(null)
    const [progress,  setProgress]  = useState(0)
    const [uploading, setUploading] = useState(false)
    const [caption,   setCaption]   = useState("")

    // Text card state
    const [body,       setBody]       = useState("")
    const [background, setBackground] = useState<string>(TEXT_CARD_BACKGROUNDS[0])
    const [fontStyle,  setFontStyle]  = useState<string>("classic")

    const [access, setAccess] = useState<{
        accessLevel:    PostAccessLevel
        allowedPlanIds: string[]
    }>({ accessLevel: "PUBLIC", allowedPlanIds: [] })

    const [feedback,  setFeedback]        = useState<string | null>(null)
    const [isPending, startTransition]    = useTransition()
    const fileRef = useRef<HTMLInputElement>(null)

    const switchMode = (m: StoryMode) => {
        setMode(m)
        setFeedback(null)
        if (preview) URL.revokeObjectURL(preview)
        setPreview(null)
        setUploaded(null)
        setDuration(null)
        setProgress(0)
        setCaption("")
    }

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setFeedback(null)

        if (mode === "VIDEO") {
            try {
                const secs = await probeDuration(file)
                if (secs > MAX_VIDEO_SECONDS) {
                    setFeedback(`Story videos are limited to ${MAX_VIDEO_SECONDS} seconds. Yours is ${secs}s.`)
                    if (fileRef.current) fileRef.current.value = ""
                    return
                }
                setDuration(secs)
            } catch {
                setFeedback("Could not read this video. Try a different file.")
                return
            }
        }

        setPreview(URL.createObjectURL(file))
        setUploading(true)
        setProgress(0)
        try {
            const result = await uploadToCloudinaryWithId(
                file,
                "stories",
                mode === "VIDEO" ? "video" : "image",
                setProgress,
            )
            setUploaded(result)
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : "Upload failed.")
            if (preview) URL.revokeObjectURL(preview)
            setPreview(null)
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    const handleSubmit = () => {
        setFeedback(null)
        startTransition(async () => {
            const res = await createStoryAction(
                mode === "TEXT_CARD"
                    ? {
                        mediaType:       "TEXT_CARD",
                        body,
                        backgroundColor: background as (typeof TEXT_CARD_BACKGROUNDS)[number],
                        fontStyle:       fontStyle as (typeof TEXT_CARD_FONTS)[number],
                        access,
                    }
                    : {
                        mediaType:          mode,
                        mediaUrl:           uploaded!.url,
                        cloudinaryPublicId: uploaded!.publicId,
                        duration:           mode === "VIDEO" ? duration ?? undefined : undefined,
                        caption:            caption || undefined,
                        access,
                    }
            )
            if (res?.error) {
                setFeedback(res.error)
            } else {
                if (preview) URL.revokeObjectURL(preview)
                onSuccess()
            }
        })
    }

    const canSubmit = mode === "TEXT_CARD"
        ? body.trim().length > 0
        : !!uploaded && !uploading

    return (
        <div className="story-composer-overlay" onClick={onClose}>
            <div
                className="story-composer"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Create story"
            >
                {/* Header */}
                <div className="story-composer__header">
                    <h2>New Story</h2>
                    <span className="story-composer__ttl">Disappears after 24h</span>
                    <button className="story-composer__close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {/* Mode tabs */}
                <div className="story-composer__modes">
                    {MODES.map((m) => (
                        <button
                            key={m.mode}
                            className={`story-mode-tab ${mode === m.mode ? "story-mode-tab--active" : ""}`}
                            onClick={() => switchMode(m.mode)}
                        >
                            {m.icon}
                            {m.label}
                        </button>
                    ))}
                </div>

                {/* Canvas — 9:16 preview */}
                <div className="story-composer__canvas">
                    {mode === "TEXT_CARD" ? (
                        <div
                            className={`story-canvas story-canvas--text story-canvas--font-${fontStyle}`}
                            style={{ backgroundColor: background }}
                        >
                            <textarea
                                className="story-canvas__text-input"
                                placeholder="Type something…"
                                value={body}
                                maxLength={280}
                                onChange={(e) => setBody(e.target.value)}
                                disabled={isPending}
                            />
                            <span className="story-canvas__char-count">{body.length}/280</span>
                        </div>
                    ) : preview ? (
                        <div className="story-canvas story-canvas--media">
                            {mode === "PHOTO"
                                ? <img src={preview} alt="Story preview" />
                                : <video src={preview} autoPlay muted loop playsInline />
                            }
                            {uploading && (
                                <div className="story-canvas__progress">
                                    <Loader2 size={20} className="spin" />
                                    <span>{progress}%</span>
                                </div>
                            )}
                            {duration !== null && mode === "VIDEO" && (
                                <span className="story-canvas__duration">{duration}s</span>
                            )}
                            <button
                                type="button"
                                className="story-canvas__replace"
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading || isPending}
                            >
                                Replace
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className="story-canvas story-canvas--empty"
                            onClick={() => fileRef.current?.click()}
                        >
                            {mode === "PHOTO" ? <ImageIcon size={28} /> : <Video size={28} />}
                            <p>Tap to upload a {mode === "PHOTO" ? "photo" : "video"}</p>
                            {mode === "VIDEO" && <span>Max {MAX_VIDEO_SECONDS} seconds</span>}
                        </button>
                    )}
                    <input
                        ref={fileRef}
                        type="file"
                        accept={mode === "VIDEO" ? "video/*" : "image/*"}
                        className="story-composer__file-input"
                        onChange={handleFile}
                    />
                </div>

                {/* Text card controls */}
                {mode === "TEXT_CARD" && (
                    <div className="story-composer__card-controls">
                        <div className="story-swatches">
                            {TEXT_CARD_BACKGROUNDS.map((hex) => (
                                <button
                                    key={hex}
                                    type="button"
                                    className={`story-swatch ${background === hex ? "story-swatch--active" : ""}`}
                                    style={{ backgroundColor: hex }}
                                    onClick={() => setBackground(hex)}
                                    aria-label={`Background ${hex}`}
                                />
                            ))}
                        </div>
                        <div className="story-fonts">
                            {TEXT_CARD_FONTS.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    className={`story-font-btn story-font-btn--${f} ${fontStyle === f ? "story-font-btn--active" : ""}`}
                                    onClick={() => setFontStyle(f)}
                                >
                                    {FONT_LABELS[f]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Caption for media stories */}
                {mode !== "TEXT_CARD" && preview && (
                    <input
                        type="text"
                        className="story-composer__caption"
                        placeholder="Add a caption… (optional)"
                        value={caption}
                        maxLength={200}
                        onChange={(e) => setCaption(e.target.value)}
                        disabled={isPending}
                    />
                )}

                {/* Access */}
                <div className="story-composer__access">
                    <AccessPicker value={access} onChange={setAccess} disabled={isPending} />
                </div>

                {feedback && <p className="story-composer__error">{feedback}</p>}

                {/* Submit */}
                <button
                    type="button"
                    className="story-composer__submit"
                    onClick={handleSubmit}
                    disabled={!canSubmit || isPending}
                >
                    {isPending
                        ? <><Loader2 size={15} className="spin" /> Sharing…</>
                        : "Share to Story"}
                </button>
            </div>
        </div>
    )
}