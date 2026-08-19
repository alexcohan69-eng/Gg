import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { notifications, posts, user } from "@/lib/db/schema"

export type NotificationType = "follow" | "like" | "reply" | "repost"

/**
 * A notification joined with the actor's public profile fields and,
 * when the notification references a post (like/reply/repost), a
 * snippet of that post's content. Shared by the notifications page and
 * (later) any realtime feed of the same rows.
 */
export type FeedNotification = {
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

/** The viewer's notifications, newest first. */
export async function getNotifications(
  viewerId: string,
  limit = NOTIFICATIONS_PAGE_SIZE,
): Promise<FeedNotification[]> {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      postId: notifications.postId,
      actorId: notifications.actorId,
      actorName: user.name,
      actorUsername: user.username,
      actorImage: user.image,
      postContent: posts.content,
    })
    .from(notifications)
    .innerJoin(user, eq(notifications.actorId, user.id))
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(eq(notifications.userId, viewerId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  return rows.map((row) => ({ ...row, type: row.type as NotificationType }))
}

/** Unread count for the viewer, used for the nav badge. */
export async function getUnreadNotificationCount(
  viewerId: string,
): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, viewerId), eq(notifications.isRead, false)),
    )

  return rows[0]?.count ?? 0
}

/**
 * Inserts a notification for `recipientId`, unless the actor and
 * recipient are the same person — every call site already knows both
 * ids from the action it's guarding (following yourself is blocked
 * earlier, but liking/replying/reposting your own post is allowed, so
 * this is the one shared place that rule needs to be enforced).
 *
 * This is a plain insert (no realtime fan-out) so the notifications
 * table stays the single source of truth the page reads from — a
 * future realtime layer (e.g. a Postgres LISTEN/NOTIFY trigger or a
 * WebSocket broadcast) can hook in right here without touching the
 * call sites below.
 */
export async function createNotification(params: {
  recipientId: string
  actorId: string
  type: NotificationType
  postId?: string | null
}): Promise<void> {
  if (params.recipientId === params.actorId) return

  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    userId: params.recipientId,
    actorId: params.actorId,
    type: params.type,
    postId: params.postId ?? null,
  })
}
