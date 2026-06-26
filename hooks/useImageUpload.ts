"use client"

import { useState, useCallback } from "react"

export type UploadedFile = {
    key:      string
    url:      string | null
    progress: number
    error:    string | null
    preview:  string
    name:     string
}

type UseImageUploadReturn = {
    files:       UploadedFile[]
    upload:      (incoming: FileList | File[] | null) => Promise<void>
    remove:      (key: string) => void
    reorder:     (fromIndex: number, toIndex: number) => void
    reset:       () => void
    isUploading: boolean
    urls:        string[]
}

const NEEDS_CONVERSION = new Set([
    "image/jfif",
    "image/x-jfif",
    "image/pjpeg",
    "image/bmp",
    "image/x-bmp",
    "image/tiff",
    "image/x-tiff",
    "image/x-icon",
    "image/vnd.microsoft.icon",
    "image/heic",
    "image/heif",
])

const NEEDS_CONVERSION_EXT = new Set([".jfif", ".jpe", ".bmp", ".tif", ".tiff", ".ico", ".heic", ".heif"])

function needsConversion(file: File): boolean {
    if (NEEDS_CONVERSION.has(file.type.toLowerCase())) return true
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    return NEEDS_CONVERSION_EXT.has(ext)
}

async function convertToCompatible(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new window.Image()
        const objectUrl = URL.createObjectURL(file)

        img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width  = img.naturalWidth
            canvas.height = img.naturalHeight

            const ctx = canvas.getContext("2d")
            if (!ctx) {
                URL.revokeObjectURL(objectUrl)
                reject(new Error("Canvas context unavailable"))
                return
            }

            // White background for formats that may have transparency
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)

            URL.revokeObjectURL(objectUrl)

            canvas.toBlob(
                (blob) => {
                    if (!blob) { reject(new Error("Canvas toBlob failed")); return }
                    const baseName = file.name.replace(/\.[^.]+$/, "")
                    resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }))
                },
                "image/jpeg",
                0.92,
            )
        }

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error(`Cannot decode image: ${file.name}`))
        }

        img.src = objectUrl
    })
}

// ── Upload a single file to Cloudinary via your API route ────────────────────

async function uploadToCloudinary(
    file: File,
    onProgress: (pct: number) => void,
): Promise<string> {
    const form = new FormData()
    form.append("file", file)

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                onProgress(Math.round((e.loaded / e.total) * 100))
            }
        })

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText)
                    if (!data.url) reject(new Error("No URL in response"))
                    else resolve(data.url as string)
                } catch {
                    reject(new Error("Invalid response from upload endpoint"))
                }
            } else {
                reject(new Error(`Upload failed: ${xhr.status}`))
            }
        })

        xhr.addEventListener("error", () => reject(new Error("Network error during upload")))
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")))

        // POST to your Next.js API route — adjust path if needed
        xhr.open("POST", "/api/upload")
        xhr.send(form)
    })
}

// ── Hook ──────────────────────────────────────────────────────────────────────

let keyCounter = 0
function newKey() { return `img-${++keyCounter}-${Date.now()}` }

export function useImageUpload(): UseImageUploadReturn {
    const [files, setFiles] = useState<UploadedFile[]>([])

    const setFile = useCallback((key: string, patch: Partial<UploadedFile>) => {
        setFiles((prev) => prev.map((f) => f.key === key ? { ...f, ...patch } : f))
    }, [])

    const upload = useCallback(async (incoming: FileList | File[] | null) => {
        if (!incoming || incoming.length === 0) return

        const raw = Array.from(incoming)

        // Build placeholder entries immediately so UI shows previews
        const placeholders: UploadedFile[] = raw.map((file) => ({
            key:      newKey(),
            url:      null,
            progress: 0,
            error:    null,
            preview:  URL.createObjectURL(file),
            name:     file.name,
        }))

        setFiles((prev) => [...prev, ...placeholders])

        // Upload each file concurrently
        await Promise.all(
            raw.map(async (rawFile, i) => {
                const { key } = placeholders[i]

                try {
                    // Convert if needed
                    const file = needsConversion(rawFile)
                        ? await convertToCompatible(rawFile)
                        : rawFile

                    const url = await uploadToCloudinary(file, (pct) => {
                        setFile(key, { progress: pct })
                    })

                    setFile(key, { url, progress: 100, error: null })
                } catch (err) {
                    const message = err instanceof Error ? err.message : "Upload failed"
                    setFile(key, { error: message, progress: 0 })
                }
            }),
        )
    }, [setFile])

    const remove = useCallback((key: string) => {
        setFiles((prev) => {
            const target = prev.find((f) => f.key === key)
            if (target?.preview) URL.revokeObjectURL(target.preview)
            return prev.filter((f) => f.key !== key)
        })
    }, [])

    const reorder = useCallback((from: number, to: number) => {
        setFiles((prev) => {
            const next = [...prev]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return next
        })
    }, [])

    const reset = useCallback(() => {
        setFiles((prev) => {
            prev.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview) })
            return []
        })
    }, [])

    const isUploading = files.some((f) => f.url === null && f.error === null)

    const urls = files
        .filter((f) => f.url !== null)
        .map((f) => f.url as string)

    return { files, upload, remove, reorder, reset, isUploading, urls }
}