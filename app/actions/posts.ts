"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { and, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { posts } from "@/lib/db/schema"
import {
  MAX_MEDIA_PER_POST,
  parseMedia,
  serializeMedia,
  validateMediaAttachments,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

const MAX_POST_LENGTH = 280

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

function mediaUrlToPathname(url: string): string | null {
  try {
    const pathname = new URL(url, "http://localhost").searchParams.get(
      "pathname",
    )
    return pathname && pathname.startsWith("posts/") ? pathname : null
  } catch {
    return null
  }
}

export type PostActionResult = {
  success: boolean
  error?: string
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

  const content = String(formData.get("content") ?? "").trim()
  const replyToIdRaw = formData.get("replyToId")
  const replyToId = replyToIdRaw ? String(replyToIdRaw) : null
  const media = parseMediaAttachments(formData)

  if (media === null) {
    return { success: false, error: "Invalid media attachment." }
  }
  if (!content && media.length === 0) {
    return { success: false, error: "Post can't be empty." }
  }
  if (content.length > MAX_POST_LENGTH) {
    return {
      success: false,
      error: `Post must be ${MAX_POST_LENGTH} characters or fewer.`,
    }
  }

  if (replyToId) {
    const [parent] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, replyToId))
      .limit(1)

    if (!parent) {
      return { success: false, error: "Original post no longer exists." }
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(posts).values({
      id: crypto.randomUUID(),
      userId,
      content,
      media: serializeMedia(media),
      replyToId,
      isReply: Boolean(replyToId),
    })

    if (replyToId) {
      await tx
        .update(posts)
        .set({ replyCount: sql`${posts.replyCount} + 1` })
        .where(eq(posts.id, replyToId))
    }
  })

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
  const pathnames = parseMedia(deleted.media)
    .map((item) => mediaUrlToPathname(item.url))
    .filter((p): p is string => p !== null)

  if (pathnames.length) {
    try {
      await del(pathnames)
    } catch (error) {
      console.error("[v0] Failed to delete post media from blob:", error)
    }
  }

  revalidatePath("/home")
  revalidatePath("/profile")
  revalidatePath(`/post/${postId}`)
  if (deleted.replyToId) revalidatePath(`/post/${deleted.replyToId}`)

  return { success: true }
}
