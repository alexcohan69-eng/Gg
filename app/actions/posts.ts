"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { and, eq, sql } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { portfolioProjects, posts, services, testimonials } from "@/lib/db/schema"
import { createNotification } from "@/lib/notifications"
import { isBlockedEitherWay } from "@/lib/blocks"
import { logActionError } from "@/lib/log-action-error"
import {
  getPostTextLength,
  isHtmlContentEmpty,
  MAX_POST_LENGTH,
  sanitizePostHtml,
} from "@/lib/sanitize-html"
import {
 MAX_MEDIA_PER_POST,
 mediaUrlToPathname,
 parseMediaColumn,
 validateMediaAttachments,
 type MediaAttachment,
 type MediaType,
} from "@/lib/media"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// Matches the delivery URL /api/upload returns: /api/media?pathname=posts%2F<userId>%2F<file>
const MEDIA_URL_PATTERN = /^\/api\/media\?pathname=posts%2F[^&]+$/
const MEDIA_TYPES: readonly MediaType[] = ["image", "gif", "video"]

/**
 * The composer uploads each file to Blob first (through /api/upload,
 * which returns our own /api/media delivery URL plus its detected
 * type — the store is private, so the raw blob.url isn't fetchable by
 * the browser) and submits the resulting {url, type} pairs as a JSON
 * array in the "media" field. Only trust our own delivery-route shape
 * and a known type, so this can't be abused to attach an
 * arbitrary attacker-controlled URL or type to a post. The full set is
 * also re-checked against the attach rules (max count, no mixing
 * video with images/gifs) since the client-side composer's own
 * enforcement is only a UX shortcut.
 */
function parseMediaAttachments(formData: FormData): MediaAttachment[] | null {
  const raw = formData.get("media")
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(String(raw))
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length > MAX_MEDIA_PER_POST) {
    return null
  }

  const media = parsed.filter(
    (item): item is MediaAttachment =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as MediaAttachment).url === "string" &&
      MEDIA_URL_PATTERN.test((item as MediaAttachment).url) &&
      MEDIA_TYPES.includes((item as MediaAttachment).type),
  )

  if (media.length !== parsed.length) return null
  if (validateMediaAttachments(media)) return null

  return media
}

export type PostActionResult = {
  success: boolean
  error?: string
}

type AttachedIds = {
  attachedServiceId: string | null
  attachedProjectId: string | null
  attachedTestimonialId: string | null
}

/**
 * Reads the composer's optional "attachedKind"/"attachedId" fields and
 * resolves them against the corresponding table, scoped to the
 * posting user — a post can only embed a preview of a service/
 * project/testimonial the author actually owns, never someone else's
 * (or a stale/deleted id). Returns an error rather than silently
 * dropping the link, since — unlike the testimonial editor's optional
 * link picker — attaching *is* the point of this submission.
 */
async function resolveAttachedItem(
  userId: string,
  formData: FormData,
): Promise<AttachedIds | { error: string }> {
  const kind = String(formData.get("attachedKind") ?? "")
  const id = String(formData.get("attachedId") ?? "").trim()
  const empty: AttachedIds = {
    attachedServiceId: null,
    attachedProjectId: null,
    attachedTestimonialId: null,
  }

  if (!kind && !id) return empty

  if (kind === "service" && id) {
    const [row] = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, id), eq(services.userId, userId)))
      .limit(1)
    if (!row) return { error: "That service is no longer available." }
    return { ...empty, attachedServiceId: id }
  }

  if (kind === "project" && id) {
    const [row] = await db
      .select({ id: portfolioProjects.id })
      .from(portfolioProjects)
      .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))
      .limit(1)
    if (!row) return { error: "That project is no longer available." }
    return { ...empty, attachedProjectId: id }
  }

  if (kind === "testimonial" && id) {
    const [row] = await db
      .select({ id: testimonials.id })
      .from(testimonials)
      .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
      .limit(1)
    if (!row) return { error: "That testimonial is no longer available." }
    return { ...empty, attachedTestimonialId: id }
  }

  return { error: "Invalid attachment." }
}

/**
 * Creates a top-level post, or — when `replyToId` is present in the
 * form data — a reply. Replies are ordinary `posts` rows: this is what
 * lets the same table and query shapes support arbitrarily nested
 * threads later without a schema change.
 */
export async function createPost(
  formData: FormData,
): Promise<PostActionResult> {
  const userId = await getUserId()

  // The composer submits rich-text HTML (bold/italic/links/lists/etc).
  // Sanitize it here — this is the real security boundary, since the
  // client-side editor only constrains the UI, not the request body.
  const content = sanitizePostHtml(String(formData.get("content") ?? ""))
  const replyToIdRaw = formData.get("replyToId")
  const replyToId = replyToIdRaw ? String(replyToIdRaw) : null
  const media = parseMediaAttachments(formData)

  if (media === null) {
    return { success: false, error: "Invalid media attachment." }
  }

  const attached = await resolveAttachedItem(userId, formData)
  if ("error" in attached) {
    return { success: false, error: attached.error }
  }
  const hasAttachment =
    attached.attachedServiceId !== null ||
    attached.attachedProjectId !== null ||
    attached.attachedTestimonialId !== null

  if (isHtmlContentEmpty(content) && media.length === 0 && !hasAttachment) {
    return { success: false, error: "Post can't be empty." }
  }
  if (getPostTextLength(content) > MAX_POST_LENGTH) {
    return { success: false, error: `Posts can't be longer than ${MAX_POST_LENGTH} characters.` }
  }

  let parentAuthorId: string | null = null
  if (replyToId) {
    const [parent] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, replyToId))
      .limit(1)

    if (!parent) {
      return { success: false, error: "Original post no longer exists." }
    }
    parentAuthorId = parent.userId

    if (await isBlockedEitherWay(userId, parentAuthorId)) {
      return { success: false, error: "You can't reply to this post." }
    }
  }

  const postId = crypto.randomUUID()

  await db.transaction(async (tx) => {
    await tx.insert(posts).values({
      id: postId,
      userId,
      content,
      // JSON-encoded TEXT — Aurora DSQL has no JSON/JSONB column type.
      media: media.length > 0 ? JSON.stringify(media) : null,
      replyToId,
      isReply: Boolean(replyToId),
      attachedServiceId: attached.attachedServiceId,
      attachedProjectId: attached.attachedProjectId,
      attachedTestimonialId: attached.attachedTestimonialId,
    })

    if (replyToId) {
      await tx
        .update(posts)
        .set({ replyCount: sql`${posts.replyCount} + 1` })
        .where(eq(posts.id, replyToId))
    }
  })

  // Notification links to the new reply itself — /post/[id] renders
  // any post as its own thread root, reply or not.
  if (replyToId && parentAuthorId) {
    await createNotification({
      recipientId: parentAuthorId,
      actorId: userId,
      type: "reply",
      postId,
    })
  }

  revalidatePath("/home")
  revalidatePath("/profile")
  if (replyToId) revalidatePath(`/post/${replyToId}`)

  return { success: true }
}

export async function deletePost(postId: string): Promise<PostActionResult> {
  const userId = await getUserId()

  // Scope the delete by userId so a user can only ever delete their own
  // posts — there is no RLS on Aurora, so this check is what protects rows.
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .returning({
        id: posts.id,
        replyToId: posts.replyToId,
        media: posts.media,
      })

    if (row?.replyToId) {
      await tx
        .update(posts)
        .set({ replyCount: sql`greatest(${posts.replyCount} - 1, 0)` })
        .where(eq(posts.id, row.replyToId))
    }

    return row
  })

  if (!deleted) {
    return { success: false, error: "Post not found." }
  }

  // Best-effort cleanup of the post's uploaded media. A failure here
  // shouldn't fail the delete — the post row is already gone.
  const pathnames = parseMediaColumn(deleted.media)
    .map((item) => mediaUrlToPathname(item.url))
    .filter((p): p is string => p !== null)

  if (pathnames.length) {
    try {
      await del(pathnames)
    } catch (error) {
      logActionError("deletePostMedia", error, { postId })
    }
  }

  revalidatePath("/home")
  revalidatePath("/profile")
  revalidatePath(`/post/${postId}`)
  if (deleted.replyToId) revalidatePath(`/post/${deleted.replyToId}`)

  return { success: true }
}
