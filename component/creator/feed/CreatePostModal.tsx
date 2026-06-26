"use client"

import { useState, useTransition, useRef, useCallback } from "react"
import {
    X, Type, ImageIcon, Video, Mic,
    BarChart2, Clock, Loader2, Plus, Trash2,
    ChevronDown, ImagePlus, GripVertical, AlertCircle,
} from "lucide-react"
import { createPostAction }                                      from "@/actions/creator/posts"
import { PostType, PostVisibility, PostAccessLevel }             from "@prisma/client"
import { AccessPicker }                                          from "./AccessPicker"
import "@/styles/creator/feed/CreatePostModal.scss"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

const POST_TYPES = [
    { type: "TEXT"  as PostType, label: "Text",  icon: <Type      size={16} /> },
    { type: "PHOTO" as PostType, label: "Photo", icon: <ImageIcon size={16} /> },
    { type: "VIDEO" as PostType, label: "Video", icon: <Video     size={16} /> },
    { type: "AUDIO" as PostType, label: "Audio", icon: <Mic       size={16} /> },
    { type: "POLL"  as PostType, label: "Poll",  icon: <BarChart2 size={16} /> },
]

// ─────────────────────────────────────────────────────────────────────────────
// Format conversion helpers
// ─────────────────────────────────────────────────────────────────────────────

const NEEDS_CONVERSION_TYPES = new Set([
    "image/jfif", "image/x-jfif", "image/pjpeg",
    "image/bmp", "image/x-bmp",
    "image/tiff", "image/x-tiff",
    "image/x-icon", "image/vnd.microsoft.icon",
    "image/heic", "image/heif",
])
const NEEDS_CONVERSION_EXT = new Set([
    ".jfif", ".jpe", ".bmp", ".tif", ".tiff", ".ico", ".heic", ".heif",
])

function needsConversion(file: File): boolean {
    if (NEEDS_CONVERSION_TYPES.has(file.type.toLowerCase())) return true
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase()
    return NEEDS_CONVERSION_EXT.has(ext)
}

async function convertToJpeg(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new window.Image()
        const src = URL.createObjectURL(file)
        img.onload = () => {
            const canvas  = document.createElement("canvas")
            canvas.width  = img.naturalWidth
            canvas.height = img.naturalHeight
            const ctx = canvas.getContext("2d")
            if (!ctx) { URL.revokeObjectURL(src); reject(new Error("No canvas context")); return }
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            URL.revokeObjectURL(src)
            canvas.toBlob(
                (blob) => {
                    if (!blob) { reject(new Error("toBlob failed")); return }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }))
                },
                "image/jpeg",
                0.92,
            )
        }
        img.onerror = () => { URL.revokeObjectURL(src); reject(new Error(`Cannot decode ${file.name}`)) }
        img.src = src
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Duration probe — works for VIDEO and AUDIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a media file into a detached <video> element and resolves with the
 * duration in whole seconds once metadata is available.
 * Rejects after 8 s in case the browser can't decode the format.
 */
function getMediaDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
        const el  = document.createElement("video")
        const src = URL.createObjectURL(file)

        const cleanup = () => {
            URL.revokeObjectURL(src)
            el.removeAttribute("src")
            el.load()
        }

        const timer = setTimeout(() => {
            cleanup()
            reject(new Error("Duration probe timed out"))
        }, 8_000)

        el.preload  = "metadata"
        el.muted    = true

        el.onloadedmetadata = () => {
            clearTimeout(timer)
            const secs = isFinite(el.duration) ? Math.round(el.duration) : 0
            cleanup()
            resolve(secs)
        }

        el.onerror = () => {
            clearTimeout(timer)
            cleanup()
            reject(new Error("Could not read media metadata"))
        }

        el.src = src
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary upload
// ─────────────────────────────────────────────────────────────────────────────

async function uploadToCloudinary(
    file: File,
    folder: string,
    resourceType: "image" | "video" | "raw" = "image",
    onProgress?: (pct: number) => void,
): Promise<string> {
    const toUpload = resourceType === "image" && needsConversion(file)
        ? await convertToJpeg(file)
        : file

    const form = new FormData()
    form.append("file",          toUpload)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder",        `nesora/${folder}`)

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const data = JSON.parse(xhr.responseText)
                data.secure_url ? resolve(data.secure_url) : reject(new Error("No URL"))
            } else {
                try { reject(new Error(JSON.parse(xhr.responseText).error?.message ?? "Upload failed")) }
                catch { reject(new Error("Upload failed")) }
            }
        }
        xhr.onerror = () => reject(new Error("Network error"))
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`)
        xhr.send(form)
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo item state
// ─────────────────────────────────────────────────────────────────────────────

type PhotoItem = {
    key:      string
    preview:  string
    url:      string | null
    progress: number
    error:    string | null
    name:     string
}

let keySeq = 0
const uid = () => `ph-${++keySeq}-${Date.now()}`

// ─────────────────────────────────────────────────────────────────────────────
// Photo grid + caption sub-component
// ─────────────────────────────────────────────────────────────────────────────

type PhotoGridProps = {
    photos:          PhotoItem[]
    caption:         string
    onCaption:       (v: string) => void
    onRemove:        (key: string) => void
    onReorder:       (from: number, to: number) => void
    onAdd:           () => void
    maxFiles:        number
    disabled:        boolean
    creatorInitial:  string
}

function PhotoGrid({
    photos, caption, onCaption, onRemove, onReorder, onAdd, maxFiles, disabled, creatorInitial,
}: PhotoGridProps) {
    const dragSrc = useRef<number | null>(null)
    const count   = Math.min(photos.length, 4)

    return (
        <div className="cpm-photo-block">
            {/* Grid */}
            <div className={`cpm-photo-grid cpm-photo-grid--${count}`}>
                {photos.map((photo, i) => (
                    <div
                        key={photo.key}
                        className={`cpm-photo-thumb ${photo.error ? "cpm-photo-thumb--error" : ""}`}
                        draggable={!disabled}
                        onDragStart={() => { dragSrc.current = i }}
                        onDragOver={(e) => {
                            e.preventDefault()
                            if (dragSrc.current !== null && dragSrc.current !== i) {
                                onReorder(dragSrc.current, i)
                                dragSrc.current = i
                            }
                        }}
                        onDragEnd={() => { dragSrc.current = null }}
                    >
                        <img src={photo.preview} alt={photo.name} className="cpm-photo-thumb__img" />

                        {/* Upload progress overlay */}
                        {!photo.url && !photo.error && (
                            <div className="cpm-photo-thumb__overlay">
                                <svg className="cpm-progress-ring" viewBox="0 0 36 36">
                                    <circle cx="18" cy="18" r="15" className="cpm-progress-ring__bg" />
                                    <circle
                                        cx="18" cy="18" r="15"
                                        className="cpm-progress-ring__fill"
                                        strokeDasharray={`${photo.progress * 0.942} 94.2`}
                                    />
                                </svg>
                                <span className="cpm-photo-thumb__pct">{photo.progress}%</span>
                            </div>
                        )}

                        {/* Error overlay */}
                        {photo.error && (
                            <div className="cpm-photo-thumb__overlay cpm-photo-thumb__overlay--error">
                                <AlertCircle size={16} />
                                <span>{photo.error}</span>
                            </div>
                        )}

                        {/* Drag handle */}
                        <div className="cpm-photo-thumb__drag" aria-hidden="true">
                            <GripVertical size={13} />
                        </div>

                        {/* Remove */}
                        <button
                            type="button"
                            className="cpm-photo-thumb__remove"
                            onClick={() => onRemove(photo.key)}
                            disabled={disabled}
                            aria-label={`Remove ${photo.name}`}
                        >
                            <X size={11} />
                        </button>
                    </div>
                ))}

                {/* Add-more tile inside grid */}
                {photos.length < 4 && photos.length < maxFiles && (
                    <button
                        type="button"
                        className="cpm-photo-add-tile"
                        onClick={onAdd}
                        disabled={disabled}
                        aria-label="Add more photos"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

            {/* Caption — flush below grid */}
            <div className="cpm-caption">
                <div className="cpm-caption__avatar">{creatorInitial}</div>
                <textarea
                    className="cpm-caption__input"
                    placeholder="Add a caption…"
                    value={caption}
                    onChange={(e) => onCaption(e.target.value)}
                    rows={2}
                    disabled={disabled}
                />
            </div>

            {/* Add-more button when grid is full */}
            {photos.length >= 4 && photos.length < maxFiles && (
                <button
                    type="button"
                    className="cpm-add-more-btn"
                    onClick={onAdd}
                    disabled={disabled}
                >
                    <Plus size={13} />
                    Add more ({photos.length}/{maxFiles})
                </button>
            )}
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
    onClose:         () => void
    onSuccess:       () => void
    initialType?:    PostType
    creatorInitial?: string
}

const MAX_PHOTOS = 10

const folderMap: Record<PostType, string> = {
    PHOTO: "posts/photos",
    VIDEO: "posts/videos",
    AUDIO: "posts/audio",
    TEXT:  "posts",
    POLL:  "posts",
}

const acceptMap: Record<PostType, string> = {
    PHOTO: "image/*,.jfif,.jpe,.heic,.heif",
    VIDEO: "video/*",
    AUDIO: "audio/*",
    TEXT:  "*",
    POLL:  "*",
}

export function CreatePostModal({
    onClose,
    onSuccess,
    initialType    = "TEXT",
    creatorInitial = "C",
}: Props) {
    const [activeType,   setActiveType]   = useState<PostType>(initialType)
    const [body,         setBody]         = useState("")
    const [caption,      setCaption]      = useState("")
    const [photos,       setPhotos]       = useState<PhotoItem[]>([])
    const [mediaUrls,     setMediaUrls]     = useState<string[]>([])
    const [videoDuration, setVideoDuration] = useState<number | null>(null)
    const [uploading,     setUploading]     = useState(false)
    const [scheduledAt,  setScheduledAt]  = useState("")
    const [showSchedule, setShowSchedule] = useState(false)
    const [pollQuestion, setPollQuestion] = useState("")
    const [pollOptions,  setPollOptions]  = useState(["", ""])
    const [feedback,     setFeedback]     = useState<string | null>(null)
    const [dragOver,     setDragOver]     = useState(false)
    const [isPending,    startTransition] = useTransition()

    const [access, setAccess] = useState<{
        accessLevel:    PostAccessLevel
        allowedPlanIds: string[]
    }>({ accessLevel: "PUBLIC", allowedPlanIds: [] })

    const fileRef = useRef<HTMLInputElement>(null)

    // ── Photo helpers ─────────────────────────────────────────────────────────

    const setPhoto = useCallback((key: string, patch: Partial<PhotoItem>) => {
        setPhotos((prev) => prev.map((p) => p.key === key ? { ...p, ...patch } : p))
    }, [])

    const uploadPhotos = useCallback(async (files: File[]) => {
        const remaining = MAX_PHOTOS - photos.length
        if (remaining <= 0) return
        const batch = files.slice(0, remaining)

        const placeholders: PhotoItem[] = batch.map((f) => ({
            key:      uid(),
            preview:  URL.createObjectURL(f),
            url:      null,
            progress: 0,
            error:    null,
            name:     f.name,
        }))
        setPhotos((prev) => [...prev, ...placeholders])

        await Promise.all(
            batch.map(async (rawFile, i) => {
                const { key } = placeholders[i]
                try {
                    const url = await uploadToCloudinary(
                        rawFile, folderMap.PHOTO, "image",
                        (pct) => setPhoto(key, { progress: pct }),
                    )
                    setPhoto(key, { url, progress: 100, error: null })
                } catch (err) {
                    setPhoto(key, { error: err instanceof Error ? err.message : "Upload failed", progress: 0 })
                }
            }),
        )
    }, [photos.length, setPhoto])

    const removePhoto  = useCallback((key: string) => {
        setPhotos((prev) => {
            const t = prev.find((p) => p.key === key)
            if (t?.preview) URL.revokeObjectURL(t.preview)
            return prev.filter((p) => p.key !== key)
        })
    }, [])

    const reorderPhotos = useCallback((from: number, to: number) => {
        setPhotos((prev) => {
            const next = [...prev]
            const [m]  = next.splice(from, 1)
            next.splice(to, 0, m)
            return next
        })
    }, [])

    // ── Non-photo upload ──────────────────────────────────────────────────────

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        if (!files.length) return
        setUploading(true)
        setFeedback(null)
        try {
            const rt = activeType === "VIDEO" ? "video" : "raw"

            // Probe duration from the first file before uploading
            // Works for both VIDEO and AUDIO since <video> can decode audio too
            if (activeType === "VIDEO" || activeType === "AUDIO") {
                try {
                    const secs = await getMediaDuration(files[0])
                    setVideoDuration(secs)
                } catch {
                    // Non-fatal — duration just won't be stored
                    setVideoDuration(null)
                }
            }

            const urls = await Promise.all(
                files.map((f) => uploadToCloudinary(f, folderMap[activeType], rt))
            )
            setMediaUrls((prev) => [...prev, ...urls])
        } catch (err) {
            setFeedback(err instanceof Error ? err.message : "Upload failed.")
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        if (files.length) uploadPhotos(files)
        if (fileRef.current) fileRef.current.value = ""
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
        if (files.length) uploadPhotos(files)
    }

    // ── Poll ──────────────────────────────────────────────────────────────────

    const addPollOption    = () => { if (pollOptions.length < 6) setPollOptions((p) => [...p, ""]) }
    const removePollOption = (i: number) => { if (pollOptions.length > 2) setPollOptions((p) => p.filter((_, j) => j !== i)) }
    const updatePollOption = (i: number, v: string) => setPollOptions((p) => p.map((o, j) => j === i ? v : o))

    // ── Tab switch ────────────────────────────────────────────────────────────

    const switchType = (type: PostType) => {
        setActiveType(type)
        setMediaUrls([])
        setVideoDuration(null)
        setPhotos((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.preview)); return [] })
        setCaption("")
        setFeedback(null)
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = (status: "PUBLISHED" | "DRAFT") => {
        setFeedback(null)
        if (photos.some((p) => !p.url && !p.error)) {
            setFeedback("Please wait for all photos to finish uploading.")
            return
        }
        startTransition(async () => {
            const photoUrls = photos.filter((p) => p.url).map((p) => p.url as string)
            const res = await createPostAction({
                type:          activeType,
                status,
                visibility:    "PUBLIC" as PostVisibility,
                body:          activeType === "PHOTO" ? (caption || undefined) : (body || undefined),
                mediaUrls:     activeType === "PHOTO" ? photoUrls : mediaUrls,
                videoDuration: (activeType === "VIDEO" || activeType === "AUDIO") && videoDuration
                               ? videoDuration
                               : undefined,
                scheduledAt:   scheduledAt || undefined,
                access,
                ...(activeType === "POLL" ? {
                    poll: { question: pollQuestion, options: pollOptions.filter(Boolean) },
                } : {}),
            })
            if (res?.error) {
                setFeedback(res.error)
            } else {
                photos.forEach((p) => URL.revokeObjectURL(p.preview))
                onSuccess()
            }
        })
    }

    const isUploading = uploading || photos.some((p) => !p.url && !p.error)
    const hasPhotos   = photos.length > 0

    return (
        <div className="post-modal-overlay" onClick={onClose}>
            <div
                className="post-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Create post"
            >
                {/* Header */}
                <div className="post-modal__header">
                    <h2>Create Post</h2>
                    <button className="post-modal__close" onClick={onClose} aria-label="Close">
                        <X size={18} />
                    </button>
                </div>

                {/* Type tabs */}
                <div className="post-modal__types">
                    {POST_TYPES.map((pt) => (
                        <button
                            key={pt.type}
                            className={`post-type-tab ${activeType === pt.type ? "post-type-tab--active" : ""}`}
                            onClick={() => switchType(pt.type)}
                        >
                            {pt.icon}
                            {pt.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="post-modal__body">

                    {/* TEXT */}
                    {activeType === "TEXT" && (
                        <textarea
                            className="post-modal__textarea"
                            placeholder="What's on your mind?"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={6}
                            disabled={isPending}
                        />
                    )}

                    {/* PHOTO */}
                    {activeType === "PHOTO" && (
                        <>
                            {hasPhotos ? (
                                <PhotoGrid
                                    photos={photos}
                                    caption={caption}
                                    onCaption={setCaption}
                                    onRemove={removePhoto}
                                    onReorder={reorderPhotos}
                                    onAdd={() => fileRef.current?.click()}
                                    maxFiles={MAX_PHOTOS}
                                    disabled={isPending}
                                    creatorInitial={creatorInitial}
                                />
                            ) : (
                                <div
                                    className={`post-modal__dropzone ${dragOver ? "post-modal__dropzone--active" : ""}`}
                                    onDrop={handleDrop}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                                    onDragLeave={() => setDragOver(false)}
                                    onClick={() => fileRef.current?.click()}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
                                    aria-label="Upload photos"
                                >
                                    <Plus size={28} />
                                    <p>Drag photos here or <span>browse</span></p>
                                    <p className="post-modal__dropzone-hint">
                                        JPEG · PNG · WEBP · GIF<br />
                                        JFIF · HEIC · BMP · TIFF also accepted
                                    </p>
                                </div>
                            )}
                            <input
                                ref={fileRef}
                                type="file"
                                accept={acceptMap.PHOTO}
                                multiple
                                className="post-modal__file-input"
                                onChange={handlePhotoInput}
                                onClick={(e) => { (e.target as HTMLInputElement).value = "" }}
                            />
                        </>
                    )}

                    {/* VIDEO / AUDIO */}
                    {(activeType === "VIDEO" || activeType === "AUDIO") && (
                        <>
                            <textarea
                                className="post-modal__textarea"
                                placeholder="Add a caption…"
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={3}
                                disabled={isPending}
                            />
                            <div className="post-modal__media">
                                {mediaUrls.length > 0 && (
                                    <div className="media-previews">
                                        {mediaUrls.map((url, i) => (
                                            <div key={url} className="media-preview">
                                                {activeType === "VIDEO" && <video src={url} controls />}
                                                {activeType === "AUDIO" && (
                                                    <div className="media-preview--audio">
                                                        <Mic size={20} />
                                                        <audio src={url} controls />
                                                    </div>
                                                )}
                                                <button
                                                    className="media-preview__remove"
                                                    onClick={() => setMediaUrls((p) => p.filter((_, j) => j !== i))}
                                                    type="button"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    className="post-modal__upload-zone"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploading || isPending}
                                    type="button"
                                >
                                    {uploading ? (
                                        <><Loader2 size={20} className="spin" /> Uploading…</>
                                    ) : (
                                        <>
                                            {activeType === "VIDEO" && <Video size={20} />}
                                            {activeType === "AUDIO" && <Mic   size={20} />}
                                            Click to upload {activeType.toLowerCase()}
                                        </>
                                    )}
                                </button>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept={acceptMap[activeType]}
                                    className="post-modal__file-input"
                                    onChange={handleFileUpload}
                                />
                            </div>
                        </>
                    )}

                    {/* POLL */}
                    {activeType === "POLL" && (
                        <div className="post-modal__poll">
                            <input
                                className="poll-question"
                                type="text"
                                placeholder="Ask your audience a question…"
                                value={pollQuestion}
                                onChange={(e) => setPollQuestion(e.target.value)}
                                disabled={isPending}
                            />
                            <div className="poll-options">
                                {pollOptions.map((opt, i) => (
                                    <div key={i} className="poll-option">
                                        <span className="poll-option__letter">
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <input
                                            type="text"
                                            placeholder={`Option ${i + 1}`}
                                            value={opt}
                                            onChange={(e) => updatePollOption(i, e.target.value)}
                                            disabled={isPending}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                type="button"
                                                className="poll-option__remove"
                                                onClick={() => removePollOption(i)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {pollOptions.length < 6 && (
                                <button type="button" className="poll-add-option" onClick={addPollOption}>
                                    <Plus size={14} /> Add option
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="post-modal__controls">
                    <AccessPicker value={access} onChange={setAccess} disabled={isPending} />
                    <button
                        type="button"
                        className={`post-control-btn ${showSchedule ? "post-control-btn--active" : ""}`}
                        onClick={() => setShowSchedule((v) => !v)}
                    >
                        <Clock size={15} />
                        {scheduledAt ? "Scheduled" : "Schedule"}
                        <ChevronDown size={13} />
                    </button>
                    {showSchedule && (
                        <input
                            type="datetime-local"
                            className="schedule-input"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            disabled={isPending}
                        />
                    )}
                </div>

                {feedback && <p className="post-modal__error">{feedback}</p>}

                {/* Actions */}
                <div className="post-modal__actions">
                    <button
                        type="button"
                        className="post-action post-action--draft"
                        onClick={() => handleSubmit("DRAFT")}
                        disabled={isPending || isUploading}
                    >
                        Save Draft
                    </button>
                    <button
                        type="button"
                        className="post-action post-action--publish"
                        onClick={() => handleSubmit("PUBLISHED")}
                        disabled={isPending || isUploading}
                    >
                        {isPending ? (
                            <><Loader2 size={15} className="spin" /> Publishing…</>
                        ) : scheduledAt ? "Schedule Post" : "Publish Now"}
                    </button>
                </div>
            </div>
        </div>
    )
}