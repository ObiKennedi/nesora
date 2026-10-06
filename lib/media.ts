// lib/media.ts

/**
 * Derives an image thumbnail URL from a video URL.
 * Supports Cloudinary video URLs by transforming them to high-quality JPEG poster frames (so_0).
 */
export function getVideoThumbnail(url: string | null | undefined): string | null {
    if (!url || typeof url !== "string") return null

    const trimmed = url.trim()
    if (!trimmed) return null

    // Already an image format
    if (/\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(trimmed)) {
        return trimmed
    }

    // Cloudinary video URL transformation
    if (trimmed.includes("res.cloudinary.com") && trimmed.includes("/video/upload/")) {
        let transformed = trimmed
        if (/\.(mp4|webm|mov|m4v|mkv|avi|ogv)(\?.*)?$/i.test(transformed)) {
            transformed = transformed.replace(/\.(mp4|webm|mov|m4v|mkv|avi|ogv)(\?.*)?$/i, ".jpg")
        } else if (!/\.(jpe?g|png|webp|avif|gif)(\?.*)?$/i.test(transformed)) {
            const [base, query] = transformed.split("?")
            transformed = query ? `${base}.jpg?${query}` : `${base}.jpg`
        }

        // Insert frame-at-offset-0 (so_0) & automatic quality/formatting
        if (!transformed.includes("/so_") && !transformed.includes("so_0")) {
            return transformed.replace("/video/upload/", "/video/upload/so_0,f_auto,q_auto/")
        }
        return transformed
    }

    return null
}

/**
 * Formats a video source URL with #t=0.001 for Safari / WebKit compatibility.
 * On Apple Safari, HTML5 <video> elements without this fragment or poster show a solid
 * black rectangle instead of seeking and rendering the initial frame.
 */
export function getSafariVideoSrc(url: string | null | undefined): string {
    if (!url || typeof url !== "string") return ""
    const trimmed = url.trim()
    if (!trimmed) return ""
    if (trimmed.includes("#t=")) return trimmed
    return `${trimmed}#t=0.001`
}

/**
 * Returns the effective thumbnail URL for a post/short.
 * Uses the explicitly defined thumbnailUrl if present, otherwise derives
 * a poster image from the video URL.
 */
export function resolveThumbnail(
    thumbnailUrl: string | null | undefined,
    videoUrl: string | null | undefined
): string | null {
    if (thumbnailUrl && thumbnailUrl.trim()) {
        return thumbnailUrl.trim()
    }
    return getVideoThumbnail(videoUrl)
}
