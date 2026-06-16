"use client"

import { useState, useTransition, useRef } from "react"
import {
    X, Type, Image, Video, Mic,
    BarChart2, Clock, Loader2, Plus, Trash2,
    ChevronDown,
} from "lucide-react"
import { createPostAction } from "@/actions/creator/posts"
import { PostType, PostVisibility, PostAccessLevel } from "@prisma/client"
import { AccessPicker } from "./AccessPicker"
import "@/styles/creator/feed/CreatePostModal.scss"

const POST_TYPES = [
    { type: "TEXT" as PostType, label: "Text", icon: <Type size={16} /> },
    { type: "PHOTO" as PostType, label: "Photo", icon: <Image size={16} /> },
    { type: "VIDEO" as PostType, label: "Video", icon: <Video size={16} /> },
    { type: "AUDIO" as PostType, label: "Audio", icon: <Mic size={16} /> },
    { type: "POLL" as PostType, label: "Poll", icon: <BarChart2 size={16} /> },
]

const resourceTypeMap: Record<string, "image" | "video" | "raw"> = {
    PHOTO: "image",
    VIDEO: "video",
    AUDIO: "raw",
    TEXT: "image",
    POLL: "image",
}

const uploadToCloudinary = async (
    file: File,
    folder: string,
    resourceType: "image" | "video" | "raw" = "image"
): Promise<string> => {
    const form = new FormData()
    form.append("file", file)
    form.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!)
    form.append("folder", `nesora/${folder}`)

    const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        { method: "POST", body: form }
    )

    const data = await res.json()

    if (!res.ok) {
        console.error("Cloudinary error:", data)
        throw new Error(data.error?.message ?? "Upload failed")
    }

    return data.secure_url as string
}

type Props = {
    onClose: () => void
    onSuccess: () => void
    initialType?: PostType
}

export const CreatePostModal = ({ onClose, onSuccess, initialType = "TEXT" }: Props) => {

    const [activeType, setActiveType] = useState<PostType>(initialType)
    const [body, setBody] = useState("")
    const [mediaUrls, setMediaUrls] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)
    const [scheduledAt, setScheduledAt] = useState("")
    const [showSchedule, setShowSchedule] = useState(false)
    const [pollQuestion, setPollQuestion] = useState("")
    const [pollOptions, setPollOptions] = useState(["", ""])
    const [feedback, setFeedback] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    // Access control state
    const [access, setAccess] = useState<{
        accessLevel: PostAccessLevel
        allowedPlanIds: string[]
    }>({
        accessLevel: "PUBLIC",
        allowedPlanIds: [],
    })

    const fileRef = useRef<HTMLInputElement>(null)

    const folderMap: Record<PostType, string> = {
        PHOTO: "posts/photos",
        VIDEO: "posts/videos",
        AUDIO: "posts/audio",
        TEXT: "posts",
        POLL: "posts",
    }

    const acceptMap: Record<PostType, string> = {
        PHOTO: "image/*",
        VIDEO: "video/*",
        AUDIO: "audio/*",
        TEXT: "*",
        POLL: "*",
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? [])
        if (!files.length) return

        setUploading(true)
        setFeedback(null)

        try {
            const resourceType = resourceTypeMap[activeType]
            const urls = await Promise.all(
                files.map((f) => uploadToCloudinary(f, folderMap[activeType], resourceType))
            )
            setMediaUrls((prev) => [...prev, ...urls])
        } catch (err) {
            console.error(err)
            setFeedback("Upload failed. Check your Cloudinary preset settings.")
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ""
        }
    }

    const removeMedia = (index: number) => {
        setMediaUrls((prev) => prev.filter((_, i) => i !== index))
    }

    const addPollOption = () => {
        if (pollOptions.length >= 6) return
        setPollOptions((prev) => [...prev, ""])
    }

    const removePollOption = (index: number) => {
        if (pollOptions.length <= 2) return
        setPollOptions((prev) => prev.filter((_, i) => i !== index))
    }

    const updatePollOption = (index: number, value: string) => {
        setPollOptions((prev) => prev.map((o, i) => i === index ? value : o))
    }

    const handleSubmit = (status: "PUBLISHED" | "DRAFT") => {
        setFeedback(null)
        startTransition(async () => {
            const res = await createPostAction({
                type: activeType,
                status,
                visibility: "PUBLIC" as PostVisibility, // kept for schema compatibility
                body: body || undefined,
                mediaUrls,
                scheduledAt: scheduledAt || undefined,
                access,   // ← Required field
                ...(activeType === "POLL" ? {
                    poll: {
                        question: pollQuestion,
                        options: pollOptions.filter(Boolean),
                    },
                } : {}),
            })

            if (res?.error) {
                setFeedback(res.error)
            } else {
                onSuccess()
            }
        })
    }

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
                            onClick={() => {
                                setActiveType(pt.type)
                                setMediaUrls([])
                                setFeedback(null)
                            }}
                        >
                            {pt.icon}
                            {pt.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="post-modal__body">
                    {(activeType === "TEXT" || activeType === "PHOTO" ||
                        activeType === "VIDEO" || activeType === "AUDIO") && (
                            <textarea
                                className="post-modal__textarea"
                                placeholder={activeType === "TEXT" ? "What's on your mind?" : "Add a caption…"}
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={activeType === "TEXT" ? 6 : 3}
                                disabled={isPending}
                            />
                        )}

                    {["PHOTO", "VIDEO", "AUDIO"].includes(activeType) && (
                        <div className="post-modal__media">
                            {mediaUrls.length > 0 && (
                                <div className="media-previews">
                                    {mediaUrls.map((url, i) => (
                                        <div key={url} className="media-preview">
                                            {activeType === "PHOTO" && <img src={url} alt={`Upload ${i + 1}`} />}
                                            {activeType === "VIDEO" && <video src={url} controls />}
                                            {activeType === "AUDIO" && (
                                                <div className="media-preview--audio">
                                                    <Mic size={20} />
                                                    <audio src={url} controls />
                                                </div>
                                            )}
                                            <button className="media-preview__remove" onClick={() => removeMedia(i)}>
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
                                        {activeType === "PHOTO" && <Image size={20} />}
                                        {activeType === "VIDEO" && <Video size={20} />}
                                        {activeType === "AUDIO" && <Mic size={20} />}
                                        Click to upload {activeType.toLowerCase()}
                                        {activeType === "PHOTO" ? "s" : ""}
                                    </>
                                )}
                            </button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept={acceptMap[activeType]}
                                multiple={activeType === "PHOTO"}
                                onChange={handleFileUpload}
                                className="post-modal__file-input"
                            />
                        </div>
                    )}

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
                    <AccessPicker
                        value={access}
                        onChange={setAccess}
                        disabled={isPending}
                    />

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
                        disabled={isPending || uploading}
                    >
                        Save Draft
                    </button>
                    <button
                        type="button"
                        className="post-action post-action--publish"
                        onClick={() => handleSubmit("PUBLISHED")}
                        disabled={isPending || uploading}
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