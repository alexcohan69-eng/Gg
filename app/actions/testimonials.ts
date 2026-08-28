"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { posts, services, portfolioProjects, testimonials } from "@/lib/db/schema"
import {
  mediaUrlToPathname,
  validateGalleryMedia,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"
import { sanitizePostHtml, stripHtmlToText } from "@/lib/sanitize-html"
import { logActionError } from "@/lib/log-action-error"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type ActionResult = {
  success: boolean
  error?: string
}

function revalidateTestimonials() {
  revalidatePath("/profile")
  revalidatePath("/profile/[username]/testimonials", "page")
  // A testimonial's "Client reviews" section can live on a service or
  // project detail page (see lib/testimonials.ts's
  // getTestimonialsForService/Project), so any add/edit/delete/reorder
  // needs to bust those too, not just the Testimonials tab itself.
  revalidatePath("/profile/[username]/services/[serviceId]", "page")
  revalidatePath("/profile/[username]/work/[projectId]", "page")
}

const MAX_AUTHOR_NAME = 60
const MAX_AUTHOR_TITLE = 80
const MAX_PROJECT_TITLE = 80
const MAX_CONTENT_TEXT = 600
const MAX_TESTIMONIALS = 30
const MIN_RATING = 1
const MAX_RATING = 5

const MEDIA_TYPES: MediaType[] = ["image", "gif", "video"]
function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && (MEDIA_TYPES as string[]).includes(value)
}

/** Parses a client-submitted `{ url, type }` media value, dropping anything malformed. */
function parseMediaAttachment(value: unknown): MediaAttachment | null {
  if (!value || typeof value !== "object") return null
  const url = "url" in value ? String((value as { url: unknown }).url ?? "").trim() : ""
  const type = "type" in value ? (value as { type: unknown }).type : "image"
  if (!url) return null
  return { url, type: isMediaType(type) ? type : "image" }
}

async function assertOwnsTestimonial(userId: string, id: string) {
  const rows = await db
    .select({ id: testimonials.id })
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Not found")
}

/**
 * Validates a client-submitted serviceId/projectId link against the
 * owner's own rows — a testimonial can only be attached to a service
 * or project the same user actually owns, never someone else's (or a
 * stale/deleted id, which is silently dropped rather than erroring so
 * a race with a concurrent delete doesn't block the save).
 */
async function resolveTestimonialLink(
  userId: string,
  serviceId: string | null,
  projectId: string | null,
): Promise<{ serviceId: string | null; projectId: string | null }> {
  if (serviceId) {
    const rows = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, serviceId), eq(services.userId, userId)))
      .limit(1)
    return { serviceId: rows[0] ? serviceId : null, projectId: null }
  }
  if (projectId) {
    const rows = await db
      .select({ id: portfolioProjects.id })
      .from(portfolioProjects)
      .where(and(eq(portfolioProjects.id, projectId), eq(portfolioProjects.userId, userId)))
      .limit(1)
    return { serviceId: null, projectId: rows[0] ? projectId : null }
  }
  return { serviceId: null, projectId: null }
}

function parseTestimonialForm(formData: FormData):
  | {
      authorName: string
      authorTitle: string | null
      authorAvatar: string | null
      rating: number | null
      content: string
      projectTitle: string | null
      media: MediaAttachment[]
      serviceId: string | null
      projectId: string | null
    }
  | { error: string } {
  const authorName = String(formData.get("authorName") ?? "").trim()
  const authorTitle = String(formData.get("authorTitle") ?? "").trim() || null
  const authorAvatar = String(formData.get("authorAvatar") ?? "").trim() || null
  const projectTitle = String(formData.get("projectTitle") ?? "").trim() || null
  const contentHtml = String(formData.get("content") ?? "")
  // "link" is a single "service:<id>" / "project:<id>" value from the
  // editor's picker (a testimonial links to at most one of the two),
  // resolved and ownership-checked separately in resolveTestimonialLink.
  const linkRaw = String(formData.get("link") ?? "").trim()
  const [linkKind, linkId] = linkRaw.includes(":") ? linkRaw.split(":", 2) : ["", ""]
  const requestedServiceId = linkKind === "service" && linkId ? linkId : null
  const requestedProjectId = linkKind === "project" && linkId ? linkId : null

  const ratingRaw = String(formData.get("rating") ?? "").trim()
  const rating = ratingRaw ? Number(ratingRaw) : null

  let media: MediaAttachment[] = []
  const mediaRaw = String(formData.get("media") ?? "[]")
  try {
    const parsed = JSON.parse(mediaRaw)
    if (Array.isArray(parsed)) {
      media = parsed
        .map((item) => parseMediaAttachment(item))
        .filter((item): item is MediaAttachment => item !== null)
    }
  } catch {
    return { error: "Invalid media." }
  }

  if (!authorName || authorName.length > MAX_AUTHOR_NAME) {
    return { error: `Client name is required and must be ${MAX_AUTHOR_NAME} characters or fewer.` }
  }
  if (authorTitle && authorTitle.length > MAX_AUTHOR_TITLE) {
    return { error: `Client title must be ${MAX_AUTHOR_TITLE} characters or fewer.` }
  }
  if (projectTitle && projectTitle.length > MAX_PROJECT_TITLE) {
    return { error: `Project label must be ${MAX_PROJECT_TITLE} characters or fewer.` }
  }
  if (rating !== null && (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING)) {
    return { error: `Rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}.` }
  }
  const mediaError = validateGalleryMedia(media)
  if (mediaError) {
    return { error: mediaError }
  }

  const sanitizedContent = sanitizePostHtml(contentHtml)
  const contentText = stripHtmlToText(sanitizedContent)
  if (!contentText) {
    return { error: "Testimonial is required." }
  }
  if (contentText.length > MAX_CONTENT_TEXT) {
    return { error: `Testimonial must be ${MAX_CONTENT_TEXT} characters or fewer.` }
  }

  return {
    authorName,
    authorTitle,
    authorAvatar,
    rating,
    content: sanitizedContent,
    projectTitle,
    media,
    serviceId: requestedServiceId,
    projectId: requestedProjectId,
  }
}

/** Adds a new testimonial to the end of the profile's Testimonials tab. */
export async function addTestimonial(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = parseTestimonialForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  const existing = await db
    .select({ id: testimonials.id })
    .from(testimonials)
    .where(eq(testimonials.userId, userId))

  if (existing.length >= MAX_TESTIMONIALS) {
    return { success: false, error: `You can add up to ${MAX_TESTIMONIALS} testimonials.` }
  }

  const link = await resolveTestimonialLink(userId, parsed.serviceId, parsed.projectId)

  await db.insert(testimonials).values({
    id: crypto.randomUUID(),
    userId,
    serviceId: link.serviceId,
    projectId: link.projectId,
    authorName: parsed.authorName,
    authorTitle: parsed.authorTitle,
    authorAvatar: parsed.authorAvatar,
    rating: parsed.rating,
    content: parsed.content,
    projectTitle: parsed.projectTitle,
    media: JSON.stringify(parsed.media),
    sortOrder: existing.length,
  })

  revalidateTestimonials()

  return { success: true }
}

/** Edits an existing testimonial. */
export async function updateTestimonial(id: string, formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsTestimonial(userId, id)

  const existingRows = await db
    .select({ authorAvatar: testimonials.authorAvatar, media: testimonials.media })
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)

  const parsed = parseTestimonialForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  const link = await resolveTestimonialLink(userId, parsed.serviceId, parsed.projectId)

  await db
    .update(testimonials)
    .set({
      serviceId: link.serviceId,
      projectId: link.projectId,
      authorName: parsed.authorName,
      authorTitle: parsed.authorTitle,
      authorAvatar: parsed.authorAvatar,
      rating: parsed.rating,
      content: parsed.content,
      projectTitle: parsed.projectTitle,
      media: JSON.stringify(parsed.media),
      updatedAt: new Date(),
    })
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))

  // Best-effort cleanup of any media that was removed (replaced
  // avatar, deleted gallery items). A failure here shouldn't fail the
  // update — the row is already saved.
  const previous = existingRows[0]
  if (previous) {
    const previousGallery = (JSON.parse(previous.media || "[]") as unknown[]).map((item) =>
      typeof item === "string" ? item : (item as { url?: string })?.url,
    )
    const previousUrls = [previous.authorAvatar, ...previousGallery].filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    )
    const nextUrls = new Set(
      [parsed.authorAvatar, ...parsed.media.map((item) => item.url)].filter(Boolean),
    )
    const removedPathnames = previousUrls
      .filter((url) => !nextUrls.has(url))
      .map((url) => mediaUrlToPathname(url))
      .filter((p): p is string => p !== null)

    if (removedPathnames.length) {
      try {
        await del(removedPathnames)
      } catch (error) {
        logActionError("updateTestimonialMedia", error, { userId, id })
      }
    }
  }

  revalidateTestimonials()

  return { success: true }
}

/** Removes a testimonial, along with its author avatar. */
export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsTestimonial(userId, id)

  const rows = await db
    .select({ authorAvatar: testimonials.authorAvatar, media: testimonials.media })
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)

  await db.delete(testimonials).where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))

  // No FK constraint (Aurora DSQL has none), so any post that shared
  // this testimonial to the feed would otherwise keep pointing at a
  // deleted id — clear the attachment instead of leaving it dangling.
  await db
    .update(posts)
    .set({ attachedTestimonialId: null })
    .where(and(eq(posts.attachedTestimonialId, id), eq(posts.userId, userId)))

  // Best-effort cleanup of the testimonial's uploaded avatar + proof
  // media. A failure here shouldn't fail the delete — the row is
  // already gone.
  const row = rows[0]
  if (row) {
    const gallery = (JSON.parse(row.media || "[]") as unknown[]).map((item) =>
      typeof item === "string" ? item : (item as { url?: string })?.url,
    )
    const urls = [row.authorAvatar, ...gallery].filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    )
    const pathnames = urls
      .map((url) => mediaUrlToPathname(url))
      .filter((p): p is string => p !== null)

    if (pathnames.length) {
      try {
        await del(pathnames)
      } catch (error) {
        logActionError("deleteTestimonialMedia", error, { userId, id })
      }
    }
  }

  revalidateTestimonials()
  revalidatePath("/home")

  return { success: true }
}

/** Swaps a testimonial's position with its neighbor to reorder the Testimonials grid. */
export async function moveTestimonial(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const userId = await getUserId()

  const rows = await db
    .select({ id: testimonials.id, sortOrder: testimonials.sortOrder })
    .from(testimonials)
    .where(eq(testimonials.userId, userId))
    .orderBy(testimonials.sortOrder)

  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return { success: false, error: "Not found" }

  const swapIndex = direction === "up" ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) return { success: true }

  const current = rows[index]
  const swap = rows[swapIndex]

  await db
    .update(testimonials)
    .set({ sortOrder: swap.sortOrder })
    .where(and(eq(testimonials.id, current.id), eq(testimonials.userId, userId)))
  await db
    .update(testimonials)
    .set({ sortOrder: current.sortOrder })
    .where(and(eq(testimonials.id, swap.id), eq(testimonials.userId, userId)))

  revalidateTestimonials()

  return { success: true }
}
