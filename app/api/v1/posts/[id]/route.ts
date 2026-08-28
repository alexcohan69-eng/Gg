import { and, eq, sql } from "drizzle-orm"
import { del } from "@vercel/blob"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { posts } from "@/lib/db/schema"
import { getPostById } from "@/lib/posts"
import { isBlockedEitherWay } from "@/lib/blocks"
import { mediaUrlToPathname, parseMediaColumn } from "@/lib/media"
import { logActionError } from "@/lib/log-action-error"

/** GET /api/v1/posts/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const post = await getPostById(id, auth.userId)
  if (!post) return apiError(404, "Post not found.")
  if (await isBlockedEitherWay(auth.userId, post.authorId)) {
    return apiError(404, "Post not found.")
  }

  return apiSuccess({ post })
}

/** DELETE /api/v1/posts/[id] — deletes a post owned by the authenticated user. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params

  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.userId, auth.userId)))
      .returning({ id: posts.id, replyToId: posts.replyToId, media: posts.media })

    if (row?.replyToId) {
      await tx
        .update(posts)
        .set({ replyCount: sql`greatest(${posts.replyCount} - 1, 0)` })
        .where(eq(posts.id, row.replyToId))
    }

    return row
  })

  if (!deleted) return apiError(404, "Post not found.")

  const pathnames = parseMediaColumn(deleted.media)
    .map((item) => mediaUrlToPathname(item.url))
    .filter((p): p is string => p !== null)

  if (pathnames.length) {
    try {
      await del(pathnames)
    } catch (error) {
      logActionError("apiDeletePostMedia", error, { postId: id })
    }
  }

  return apiSuccess({ deleted: true })
}
