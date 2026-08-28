import { and, eq, sql } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { posts, reposts } from "@/lib/db/schema"
import { isBlockedEitherWay } from "@/lib/blocks"
import { createNotification } from "@/lib/notifications"

async function getPostAuthor(postId: string) {
  const [post] = await db.select({ userId: posts.userId }).from(posts).where(eq(posts.id, postId)).limit(1)
  return post?.userId ?? null
}

/** POST /api/v1/posts/[id]/repost */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id: postId } = await params
  const authorId = await getPostAuthor(postId)
  if (!authorId) return apiError(404, "Post not found.")
  if (await isBlockedEitherWay(auth.userId, authorId)) {
    return apiError(403, "You can't interact with this post.")
  }

  const inserted = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(reposts)
      .values({ id: crypto.randomUUID(), userId: auth.userId, postId })
      .onConflictDoNothing()
      .returning({ id: reposts.id })

    if (rows.length > 0) {
      await tx.update(posts).set({ repostCount: sql`${posts.repostCount} + 1` }).where(eq(posts.id, postId))
    }
    return rows.length > 0
  })

  if (inserted) {
    await createNotification({ recipientId: authorId, actorId: auth.userId, type: "repost", postId })
  }

  return apiSuccess({ reposted: true })
}

/** DELETE /api/v1/posts/[id]/repost */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id: postId } = await params

  await db.transaction(async (tx) => {
    const rows = await tx
      .delete(reposts)
      .where(and(eq(reposts.userId, auth.userId), eq(reposts.postId, postId)))
      .returning({ id: reposts.id })

    if (rows.length > 0) {
      await tx
        .update(posts)
        .set({ repostCount: sql`greatest(${posts.repostCount} - 1, 0)` })
        .where(eq(posts.id, postId))
    }
  })

  return apiSuccess({ reposted: false })
}
