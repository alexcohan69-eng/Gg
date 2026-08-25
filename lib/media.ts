/**
 * Shared media-attachment constants and validation, used by both the
 * client (post composer) and the server (upload route + createPost
 * action) so none of the three ever drift out of sync.
 *
 * Three attachment kinds are supported:
 * - "image": static JPEG/PNG/WebP
 * - "gif": image/gif — kept as its own type (not lumped into "image")
 *   so the UI can badge it and so future rendering rules can diverge,
 *   even though it's delivered the same way an image is.
 * - "video": MP4/WebM/MOV, rendered with a native <video> player.
 */

export type MediaType = "image" | "gif" | "video"

export type MediaAttachment = {
  url: string
  type: MediaType
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export const ALLOWED_GIF_TYPES = ["image/gif"] as const

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const

export const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_GIF_TYPES,
  ...ALLOWED_VIDEO_TYPES,
] as const

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const MAX_VIDEO_SIZE_BYTES = 20 * 1024 * 1024 // 20MB — kept small since
// there's no transcoding pipeline and /api/media has no HTTP Range
// passthrough guarantee (see app/api/media/route.ts).

export const MAX_MEDIA_PER_POST = 4
export const MAX_VIDEOS_PER_POST = 1

/** Back-compat alias for existing callers/tests. */
export const MAX_IMAGES_PER_POST = MAX_MEDIA_PER_POST

export function getMediaTypeForMime(mime: string): MediaType | null {
  if ((ALLOWED_GIF_TYPES as readonly string[]).includes(mime)) return "gif"
  if ((ALLOWED_IMAGE_TYPES as readonly string[]).includes(mime)) return "image"
  if ((ALLOWED_VIDEO_TYPES as readonly string[]).includes(mime)) return "video"
  return null
}

export function isAllowedMediaType(type: string): boolean {
  return (ALLOWED_MEDIA_TYPES as readonly string[]).includes(type)
}

/** @deprecated use isAllowedMediaType */
export function isAllowedImageType(type: string): boolean {
  return (
    (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type) ||
    (ALLOWED_GIF_TYPES as readonly string[]).includes(type)
  )
}

export function maxSizeForMime(mime: string): number {
  return (ALLOWED_VIDEO_TYPES as readonly string[]).includes(mime)
    ? MAX_VIDEO_SIZE_BYTES
    : MAX_IMAGE_SIZE_BYTES
}

/**
 * Validates a single file before/at upload time. Used both by the
 * composer (fast client-side feedback) and by /api/upload (the real
 * security boundary — the client check is only a UX shortcut).
 */
export function validateMediaFile(file: {
  type: string
  size: number
}): string | null {
  const mediaType = getMediaTypeForMime(file.type)
  if (!mediaType) {
    return "Only JPEG, PNG, WebP, GIF images and MP4, WebM, or MOV videos are supported."
  }
  const maxSize = maxSizeForMime(file.type)
  if (file.size <= 0 || file.size > maxSize) {
    return mediaType === "video"
      ? `Videos must be ${Math.round(maxSize / (1024 * 1024))}MB or smaller.`
      : `Images and GIFs must be ${Math.round(maxSize / (1024 * 1024))}MB or smaller.`
  }
  return null
}

/**
 * Validates a full attachment set for a post (server-side, in
 * createPost) — videos can't be mixed with images/gifs and are
 * capped at one per post, mirroring the composer's own attach rules
 * so a crafted request can't bypass them.
 */
export function validateMediaAttachments(
  media: MediaAttachment[],
): string | null {
  if (media.length > MAX_MEDIA_PER_POST) {
    return `You can attach up to ${MAX_MEDIA_PER_POST} items per post.`
  }
  const videoCount = media.filter((m) => m.type === "video").length
  if (videoCount > MAX_VIDEOS_PER_POST) {
    return "You can only attach one video per post."
  }
  if (videoCount > 0 && media.length > videoCount) {
    return "Videos can't be combined with images or GIFs in the same post."
  }
  return null
}

/** @deprecated use validateMediaFile */
export function validateImageFile(file: {
  type: string
  size: number
}): string | null {
  return validateMediaFile(file)
}

/**
 * Portfolio case studies allow more media than a single post (a cover
 * plus a gallery), and — unlike posts — videos can be mixed freely
 * with images/GIFs in the gallery, so `validateMediaAttachments`
 * (post-specific: one video, never combined) doesn't apply here.
 */
export const MAX_GALLERY_ITEMS = 12
export const MAX_GALLERY_VIDEOS = 4

/** Validates a portfolio project's full gallery set (server-side, in the portfolio actions). */
export function validateGalleryMedia(media: MediaAttachment[]): string | null {
  if (media.length > MAX_GALLERY_ITEMS) {
    return `You can add up to ${MAX_GALLERY_ITEMS} gallery items.`
  }
  const videoCount = media.filter((m) => m.type === "video").length
  if (videoCount > MAX_GALLERY_VIDEOS) {
    return `You can add up to ${MAX_GALLERY_VIDEOS} videos in the gallery.`
  }
  return null
}

/**
 * Recovers the Blob pathname (e.g. "posts/<userId>/<file>") from one of
 * our own /api/media delivery URLs, so callers that only have the
 * public-facing URL (createPost's own cleanup, and the admin
 * post-removal action in app/actions/admin.ts) can pass it to
 * `del()`. Shared here — rather than left local to app/actions/posts.ts —
 * because a "use server" file can only export async functions.
 */
export function mediaUrlToPathname(url: string): string | null {
  try {
    const pathname = new URL(url, "http://localhost").searchParams.get(
      "pathname",
    )
    return pathname &&
      (pathname.startsWith("posts/") ||
        pathname.startsWith("portfolio/") ||
        pathname.startsWith("services/"))
      ? pathname
      : null
  } catch {
    return null
  }
}

/**
 * `posts.media` is stored as JSON-encoded TEXT (Aurora DSQL has no
 * JSON/JSONB column type) — parse defensively so a null or malformed
 * value falls back to an empty list instead of throwing.
 */
export function parseMediaColumn(value: string | null): MediaAttachment[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as MediaAttachment[]) : []
  } catch {
    return []
  }
}

/** Avatar/banner uploads allow images and GIFs, but never video. */
export const ALLOWED_PROFILE_IMAGE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_GIF_TYPES,
] as const

/**
 * Validates an avatar/banner upload. Shared by the profile image
 * editor (client, for fast feedback) and /api/upload/profile-image
 * (server, the real gate) so the two rule sets can't drift apart.
 */
export function validateProfileImageFile(file: {
  type: string
  size: number
}): string | null {
  if (!(ALLOWED_PROFILE_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are supported."
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_SIZE_BYTES) {
    return `Images must be ${Math.round(MAX_IMAGE_SIZE_BYTES / (1024 * 1024))}MB or smaller.`
  }
  return null
}
