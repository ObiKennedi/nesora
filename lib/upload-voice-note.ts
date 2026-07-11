// lib/upload-voice-note.ts

const CLOUD_NAME    = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!

export type VoiceNoteUpload = {
    url:      string
    publicId: string
    duration: number
}

export async function uploadVoiceNote(
    blob:            Blob,
    clientDuration:  number,
    onProgress?:     (percent: number) => void
): Promise<VoiceNoteUpload> {
    if (!blob || blob.size === 0) {
        throw new Error("Recording is empty — nothing was captured.")
    }

    const formData = new FormData()

    const ext  = blob.type.includes("mp4") ? "mp4" : "webm"
    const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type })

    formData.append("file",          file)
    formData.append("upload_preset", UPLOAD_PRESET)
    formData.append("folder",        "nesora/voice-notes")

    return new Promise<VoiceNoteUpload>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.open(
            "POST",
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`
        )

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100))
            }
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText)
                    resolve({
                        url:      data.secure_url as string,
                        publicId: data.public_id  as string,
                        duration: Math.round(Number(data.duration) || clientDuration),
                    })
                } catch {
                    reject(new Error("Unexpected response from upload server."))
                }
            } else {
                reject(new Error(`Upload failed (${xhr.status}). Please try again.`))
            }
        }

        xhr.onerror   = () => reject(new Error("Upload failed. Check your connection and try again."))
        xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."))
        xhr.timeout   = 60_000

        xhr.send(formData)
    })
}