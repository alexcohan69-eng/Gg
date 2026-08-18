/**
 * Shared image-attachment constants and validation, used by both the
 * client (post composer) and the server (upload route) so the two
 * never drift out of sync.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const MAX_IMAGES_PER_POST = 4

export function isAllowedImageType(type: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type)
}

export function isAllowedImageSize(size: number): boolean {
  return size > 0 && size <= MAX_IMAGE_SIZE_BYTES
}

export function validateImageFile(file: {
  type: string
  size: number
}): string | null {
  if (!isAllowedImageType(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are supported."
  }
  if (!isAllowedImageSize(file.size)) {
    return "Images must be 5MB or smaller."
  }
  return null
}
