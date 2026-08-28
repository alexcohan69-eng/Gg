import { eq, sql } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody, parsePagination } from "@/lib/api/response"
import { db } from "@/lib/db"
import { posts } from "@/lib/db/schema"
import { getFeedPosts, getFollowingFeed } from "@/lib/posts"
import { getBlockedUserIds, isBlockedEitherWay } from "@/lib/blocks"
import { createNotification } from "@/lib/notifications"
import {
  getPostTextLength,
  isHtmlContentEmpty,
  MAX_POST_LENGTH,
  sanitizePostHtml,
} from "@/lib/sanitize-html"
import {
  parseMediaColumn,
  validateMediaAttachments,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"

/**
 * GET /api/v1/posts — the authenticated user's home feed.
 * Query params: `following=true` for the follows-scoped feed (defaults
 * to the global "for you" feed), `limit`, `cursor` (reserved).
 */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const following = url.searchParams.get("following") === "true"
  const { limit } = parsePagination(request)

  const blocked = await getBlockedUserIds(auth.userId)
  const results = following
    ? await getFollowingFeed(auth.userId, blocked, limit)
    : await getFeedPosts(auth.userId, blocked, limit)

  return apiSuccess({ posts: results })
}

const MEDIA_TYPES: readonly MediaType[] = ["image", "gif", "video"]

function parseMediaBody(value: unknown): MediaAttachment[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const media = value.filter(
    (item): item is MediaAttachment =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as MediaAttachment).url === "string" &&
      MEDIA_TYPES.includes((item as MediaAttachment).type),
  )
  if (media.length !== value.length) return null
  if (validateMediaAttachments(media)) return null
  return media
}

type CreatePostBody = {
  content: string
  replyToId?: string | null
  media?: MediaAttachment[]
}

/** POST /api/v1/posts — create a top-level post, or a reply when `replyToId` is set. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<CreatePostBody>(request)
  if ("error" in body) return body.error

  const content = sanitizePostHtml(String(body.data.content ?? ""))
  const replyToId = body.data.replyToId ? String(body.data.replyToId) : null
  const media = parseMediaBody(body.data.media)

  if (media === null) return apiError(400, "Invalid media attachment.")
  if (isHtmlContentEmpty(content) && media.length === 0) {
    return apiError(400, "Post can't be empty.")
  }
  if (getPostTextLength(content) > MAX_POST_LENGTH) {
    return apiError(400, `Posts can't be longer than ${MAX_POST_LENGTH} characters.`)
  }

  let parentAuthorId: string | null = null
  if (replyToId) {
    const [parent] = await db
      .select({ id: posts.id, userId: posts.userId })
      .from(posts)
      .where(eq(posts.id, replyToId))
      .limit(1)
    if (!parent) return apiError(404, "Original post no longer exists.")
    parentAuthorId = parent.userId
    if (await isBlockedEitherWay(auth.userId, parentAuthorId)) {
      return apiError(403, "You can't reply to this post.")
    }
  }

  const postId = crypto.randomUUID()

  await db.transaction(async (tx) => {
    await tx.insert(posts).values({
      id: postId,
      userId: auth.userId,
      content,
      media: media.length > 0 ? JSON.stringify(media) : null,
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

  if (replyToId && parentAuthorId) {
    await createNotification({ recipientId: parentAuthorId, actorId: auth.userId, type: "reply", postId })
  }

  const [created] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1)

  return apiSuccess(
    {
      post: created
        ? { ...created, media: parseMediaColumn(created.media) }
        : { id: postId },
    },
    201,
  )
}
