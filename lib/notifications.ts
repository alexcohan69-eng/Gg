import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { notifications, posts, user } from "@/lib/db/schema"

export type NotificationType = "follow" | "like" | "reply" | "repost"

/**
 * A notification joined with the actor's public profile and (when the
 * notification references one) a short preview of the related post.
 * Shared shape for the notifications page and any future badge/menu.
 */
export type NotificationItem = {
  id: string
  type: NotificationType
  isRead: boolean
  createdAt: Date
  postId: string | null
  actorId: string
  actorName: string
  actorUsername: string | null
  actorImage: string | null
  postContent: string | null
}

const NOTIFICATIONS_PAGE_SIZE = 50

/**
 * Most recent notifications for `userId`, newest first, joined with
 * the actor's profile and a preview of the related post (if any).
 * Notifications whose actor account no longer exists are skipped via
 * the inner join — there's nothing useful to render for them.
 */
export async function getNotifications(
  userId: string,
  limit = NOTIFICATIONS_PAGE_SIZE,
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
    ...row,
    type: row.type as NotificationType,
  }))
}

/** Count of unread notifications for `userId`, for nav badges. */
export async function getUnreadNotificationCount(userId: string) {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))

  return rows[0]?.count ?? 0
}

/**
 * Inserts a notification for `userId` triggered by `actorId`, unless
 * they're the same person — every call site (follow/like/reply/
 * repost) routes through here so the self-notification guard lives in
 * exactly one place.
 */
export async function createNotification(params: {
  userId: string
  actorId: string
  type: NotificationType
  postId?: string
}) {
  if (params.userId === params.actorId) return

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId: params.userId,
    actorId: params.actorId,
    type: params.type,
    postId: params.postId ?? null,
  })
}
