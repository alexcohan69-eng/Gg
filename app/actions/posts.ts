"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { posts } from "@/lib/db/schema"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

const MAX_POST_LENGTH = 280

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

  if (!content) {
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
  // posts — there is no RLS on Neon, so this check is what protects rows.
  const deleted = await db.transaction(async (tx) => {
    const [row] = await tx
      .delete(posts)
      .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
      .returning({ id: posts.id, replyToId: posts.replyToId })

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

  revalidatePath("/home")
  revalidatePath("/profile")
  revalidatePath(`/post/${postId}`)
  if (deleted.replyToId) revalidatePath(`/post/${deleted.replyToId}`)

  return { success: true }
}
