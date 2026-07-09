// lib/cloudinary-client.ts
"use client"

export type CloudinaryUpload = { url: string; publicId: string }

export async function uploadToCloudinaryWithId(
    file: File,
    folder: string,
    resourceType: "image" | "video" = "image",
    onProgress?: (pct: number) => void,
): Promise<CloudinaryUpload> {
    const form = new FormData()
    form.append("file",          file)
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
                if (data.secure_url && data.public_id) {
                    resolve({ url: data.secure_url, publicId: data.public_id })
                } else {
                    reject(new Error("Upload response missing URL"))
                }
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