"use server"

import { headers } from "next/headers"
import { and, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { bookmarks, likes, posts, reposts } from "@/lib/db/schema"
import { createNotification, type NotificationType } from "@/lib/notifications"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type InteractionResult = {
  success: boolean
  error?: string
}

/**
 * Shared shape for a toggleable interaction table (likes, reposts) that
 * also maintains a denormalized count column on `posts`. Insert/delete
 * are guarded with onConflictDoNothing / a `returning` check so a
 * double-click (or a retried request) never double counts.
 */
async function addInteraction(
  table: typeof likes | typeof reposts,
  countColumn: "likeCount" | "repostCount",
  notificationType: NotificationType,
  userId: string,
  postId: string,
) {
  const postAuthorId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(table)
      .values({ id: crypto.randomUUID(), userId, postId })
      .onConflictDoNothing()
      .returning({ id: table.id })

    // Only a genuinely new row (not a duplicate like/repost request)
    // bumps the count and is worth notifying the author about.
    if (inserted.length === 0) return null

    const [updated] = await tx
      .update(posts)
      .set({ [countColumn]: sql`${posts[countColumn]} + 1` })
      .where(eq(posts.id, postId))
      .returning({ authorId: posts.userId })

    return updated?.authorId ?? null
  })

  if (postAuthorId) {
    await createNotification({
      userId: postAuthorId,
      actorId: userId,
      type: notificationType,
      postId,
    })
  }
}

async function removeInteraction(
  table: typeof likes | typeof reposts,
  countColumn: "likeCount" | "repostCount",
  userId: string,
  postId: string,
) {
  await db.transaction(async (tx) => {
    const deleted = await tx
      .delete(table)
      .where(and(eq(table.userId, userId), eq(table.postId, postId)))
      .returning({ id: table.id })

    if (deleted.length > 0) {
      await tx
        .update(posts)
        .set({ [countColumn]: sql`greatest(${posts[countColumn]} - 1, 0)` })
        .where(eq(posts.id, postId))
    }
  })
}

export async function likePost(postId: string): Promise<InteractionResult> {
  try {
    const userId = await getUserId()
    await addInteraction(likes, "likeCount", "like", userId, postId)
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't like post." }
  }
}

export async function unlikePost(postId: string): Promise<InteractionResult> {
  try {
    const userId = await getUserId()
    await removeInteraction(likes, "likeCount", userId, postId)
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't unlike post." }
  }
}

export async function repostPost(postId: string): Promise<InteractionResult> {
  try {
    const userId = await getUserId()
    await addInteraction(reposts, "repostCount", "repost", userId, postId)
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't repost." }
  }
}

export async function undoRepost(postId: string): Promise<InteractionResult> {
  try {
    const userId = await getUserId()
    await removeInteraction(reposts, "repostCount", userId, postId)
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't undo repost." }
  }
}

export async function bookmarkPost(
  postId: string,
): Promise<InteractionResult> {
  try {
    const userId = await getUserId()
    await db
      .insert(bookmarks)
      .values({ id: crypto.randomUUID(), userId, postId })
      .onConflictDoNothing()
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't bookmark post." }
  }
}

export async function removeBookmark(
  postId: string,
): Promise<InteractionResult> {
  try {
    const userId = await getUserId()
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't remove bookmark." }
  }
}
