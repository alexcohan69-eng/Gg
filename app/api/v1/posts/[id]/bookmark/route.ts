import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { bookmarks } from "@/lib/db/schema"

/** POST /api/v1/posts/[id]/bookmark */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id: postId } = await params
  await db
    .insert(bookmarks)
    .values({ id: crypto.randomUUID(), userId: auth.userId, postId })
    .onConflictDoNothing()

  return apiSuccess({ bookmarked: true })
}

/** DELETE /api/v1/posts/[id]/bookmark */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id: postId } = await params
  await db.delete(bookmarks).where(and(eq(bookmarks.userId, auth.userId), eq(bookmarks.postId, postId)))

  return apiSuccess({ bookmarked: false })
}
