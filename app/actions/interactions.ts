"use server"

import { headers } from "next/headers"
import { and, eq, sql } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { bookmarks, likes, posts, reposts } from "@/lib/db/schema"
import { createNotification, type NotificationType } from "@/lib/notifications"
import { isBlockedEitherWay } from "@/lib/blocks"
import { logActionError } from "@/lib/log-action-error"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
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
/** Returns whether a new row was actually inserted (false on a no-op conflict). */
async function addInteraction(
  table: typeof likes | typeof reposts,
  countColumn: "likeCount" | "repostCount",
  userId: string,
  postId: string,
): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(table)
      .values({ id: crypto.randomUUID(), userId, postId })
      .onConflictDoNothing()
      .returning({ id: table.id })

    if (inserted.length > 0) {
      await tx
        .update(posts)
        .set({ [countColumn]: sql`${posts[countColumn]} + 1` })
        .where(eq(posts.id, postId))
    }

    return inserted.length > 0
  })
}

/**
 * Notifies a post's author about a like/repost, unless it was a no-op
 * (interaction already existed) — only a freshly created interaction
 * should notify, so re-clicking like/unlike/like doesn't spam the
 * recipient with duplicate notifications.
 */
async function notifyPostAction(
  postId: string,
  actorId: string,
  type: NotificationType,
) {
  const [post] = await db
    .select({ userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1)

  if (!post) return

  await createNotification({
    recipientId: post.userId,
    actorId,
    type,
    postId,
  })
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

/**
 * Rejects the interaction when the actor and the post's author have
 * blocked each other in either direction. Posts from blocked accounts
 * are already filtered out of feeds/search, but a direct link (or a
 * block created after the post was loaded) could still let someone
 * reach the action — this is the actual enforcement boundary.
 */
async function assertNotBlockedByPostAuthor(userId: string, postId: string) {
  const [post] = await db
    .select({ userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1)

  if (post && (await isBlockedEitherWay(userId, post.userId))) {
    throw new Error("You can't interact with this post.")
  }
}

// Every `*ForUser` function below takes `userId` directly instead of
// resolving it from the request itself, so both the web app's
// session-authenticated action (the thin wrapper right after it) and
// the public `/api/v1/...` routes (authenticated by API key) share one
// implementation — the only difference is how `userId` was determined.

export async function likePostForUser(userId: string, postId: string): Promise<InteractionResult> {
  try {
    await assertNotBlockedByPostAuthor(userId, postId)
    const inserted = await addInteraction(likes, "likeCount", userId, postId)
    if (inserted) await notifyPostAction(postId, userId, "like")
    return { success: true }
  } catch (error) {
    logActionError("likePost", error, { postId })
    return {
      success: false,
      error: error instanceof Error ? error.message : "Couldn't like post.",
    }
  }
}

export async function likePost(postId: string): Promise<InteractionResult> {
  const userId = await getUserId()
  return likePostForUser(userId, postId)
}

export async function unlikePostForUser(userId: string, postId: string): Promise<InteractionResult> {
  try {
    await removeInteraction(likes, "likeCount", userId, postId)
    return { success: true }
  } catch (error) {
    logActionError("unlikePost", error, { postId })
    return { success: false, error: "Couldn't unlike post." }
  }
}

export async function unlikePost(postId: string): Promise<InteractionResult> {
  const userId = await getUserId()
  return unlikePostForUser(userId, postId)
}

export async function repostPostForUser(userId: string, postId: string): Promise<InteractionResult> {
  try {
    await assertNotBlockedByPostAuthor(userId, postId)
    const inserted = await addInteraction(reposts, "repostCount", userId, postId)
    if (inserted) await notifyPostAction(postId, userId, "repost")
    return { success: true }
  } catch (error) {
    logActionError("repostPost", error, { postId })
    return {
      success: false,
      error: error instanceof Error ? error.message : "Couldn't repost.",
    }
  }
}

export async function repostPost(postId: string): Promise<InteractionResult> {
  const userId = await getUserId()
  return repostPostForUser(userId, postId)
}

export async function undoRepostForUser(userId: string, postId: string): Promise<InteractionResult> {
  try {
    await removeInteraction(reposts, "repostCount", userId, postId)
    return { success: true }
  } catch (error) {
    logActionError("undoRepost", error, { postId })
    return { success: false, error: "Couldn't undo repost." }
  }
}

export async function undoRepost(postId: string): Promise<InteractionResult> {
  const userId = await getUserId()
  return undoRepostForUser(userId, postId)
}

export async function bookmarkPostForUser(userId: string, postId: string): Promise<InteractionResult> {
  try {
    await db
      .insert(bookmarks)
      .values({ id: crypto.randomUUID(), userId, postId })
      .onConflictDoNothing()
    return { success: true }
  } catch (error) {
    logActionError("bookmarkPost", error, { postId })
    return { success: false, error: "Couldn't bookmark post." }
  }
}

export async function bookmarkPost(
  postId: string,
): Promise<InteractionResult> {
  const userId = await getUserId()
  return bookmarkPostForUser(userId, postId)
}

export async function removeBookmarkForUser(userId: string, postId: string): Promise<InteractionResult> {
  try {
    await db
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
    return { success: true }
  } catch (error) {
    logActionError("removeBookmark", error, { postId })
    return { success: false, error: "Couldn't remove bookmark." }
  }
}

export async function removeBookmark(
  postId: string,
): Promise<InteractionResult> {
  const userId = await getUserId()
  return removeBookmarkForUser(userId, postId)
}
