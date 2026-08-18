import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { notifications, posts, user } from "@/lib/db/schema"

export type NotificationType = "follow" | "like" | "reply" | "repost"

export type NotificationItem = {
  id: string
  type: NotificationType
  isRead: boolean
  createdAt: Date
  actor: {
    id: string
    name: string
    username: string | null
    image: string | null
  }
  postId: string | null
  /** First ~120 chars of the related post's content, if any. */
  postExcerpt: string | null
}

const POST_EXCERPT_LENGTH = 120

/**
 * A `notifications` row's dedup key is (userId, actorId, type, postId).
 * There's a matching unique index (`notifications_dedup_uidx`) for the
 * three interaction types below, where `postId` is always present, so
 * `createInteractionNotification` can lean on `ON CONFLICT ... DO
 * UPDATE` to resurface an already-read notification as unread instead
 * of stacking up duplicates (e.g. unlike-then-relike the same post).
 *
 * `follow` notifications have no postId, and Postgres treats every
 * NULL as distinct for uniqueness purposes, so that index can't dedup
 * them — `createFollowNotification` below handles that case with an
 * explicit select-then-update-or-insert instead.
 */
export async function createInteractionNotification({
  recipientId,
  actorId,
  type,
  postId,
}: {
  recipientId: string
  actorId: string
  type: "like" | "reply" | "repost"
  postId: string
}) {
  if (recipientId === actorId) return

  await db
    .insert(notifications)
    .values({
      id: crypto.randomUUID(),
      userId: recipientId,
      actorId,
      type,
      postId,
    })
    .onConflictDoUpdate({
      target: [
        notifications.userId,
        notifications.actorId,
        notifications.type,
        notifications.postId,
      ],
      set: { isRead: false, createdAt: new Date() },
    })
}

export async function createFollowNotification({
  recipientId,
  actorId,
}: {
  recipientId: string
  actorId: string
}) {
  if (recipientId === actorId) return

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, recipientId),
          eq(notifications.actorId, actorId),
          eq(notifications.type, "follow"),
        ),
      )
      .limit(1)

    if (existing) {
      await tx
        .update(notifications)
        .set({ isRead: false, createdAt: new Date() })
        .where(eq(notifications.id, existing.id))
      return
    }

    await tx.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: recipientId,
      actorId,
      type: "follow",
      postId: null,
    })
  })
}

export async function getNotifications(
  userId: string,
  limit = 50,
): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      postId: notifications.postId,
      actorId: user.id,
      actorName: user.name,
      actorUsername: user.username,
      actorImage: user.image,
      postContent: posts.content,
    })
    .from(notifications)
    .innerJoin(user, eq(notifications.actorId, user.id))
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    id: row.id,
    type: row.type as NotificationType,
    isRead: row.isRead,
    createdAt: row.createdAt,
    actor: {
      id: row.actorId,
      name: row.actorName,
      username: row.actorUsername,
      image: row.actorImage,
    },
    postId: row.postId,
    postExcerpt: row.postContent
      ? row.postContent.slice(0, POST_EXCERPT_LENGTH)
      : null,
  }))
}

export async function getUnreadNotificationCount(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))

  return row?.count ?? 0
}

/** Marks a single notification read, scoped to its owner. */
export async function markNotificationRead(id: string, userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
}

/**
 * Removes every notification pointing at a deleted post — this covers
 * both directions: like/repost notifications *about* the post, and
 * (since a reply notification's postId is the reply's own id) the
 * reply notification itself when the deleted post was a reply.
 */
export async function deleteNotificationsForPost(postId: string) {
  await db.delete(notifications).where(eq(notifications.postId, postId))
}
