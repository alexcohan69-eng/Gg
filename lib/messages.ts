import { and, desc, eq, inArray, ne, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { conversations, messages, user } from "@/lib/db/schema"

/** Public profile fields needed to render the other side of a conversation. */
export type ConversationParticipant = {
  id: string
  name: string
  username: string | null
  image: string | null
}

export type ConversationSummary = {
  id: string
  otherUser: ConversationParticipant
  lastMessage: { content: string; senderId: string; createdAt: Date } | null
  lastMessageAt: Date
  unreadCount: number
}

export type ThreadMessage = {
  id: string
  conversationId: string
  senderId: string
  content: string
  isRead: boolean
  createdAt: Date
}

export type ConversationWithParticipant = {
  id: string
  otherUser: ConversationParticipant
}

/**
 * Always store the smaller id as user1Id — lets every lookup (and the
 * unique index backing it) use a plain equality match instead of an
 * OR of both orderings.
 */
function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

/**
 * Finds the existing 1:1 conversation between two users, or creates
 * one. Race-safe: a concurrent double-click from either user hits the
 * unique (user1Id, user2Id) index and `onConflictDoNothing` absorbs
 * the loser, so both calls resolve to the same conversation id.
 */
export async function getOrCreateConversation(
  viewerId: string,
  otherUserId: string,
): Promise<string> {
  if (viewerId === otherUserId) {
    throw new Error("You can't start a conversation with yourself.")
  }

  const [user1Id, user2Id] = sortPair(viewerId, otherUserId)

  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.user1Id, user1Id), eq(conversations.user2Id, user2Id)),
    )
    .limit(1)

  if (existing[0]) return existing[0].id

  const id = crypto.randomUUID()
  await db
    .insert(conversations)
    .values({ id, user1Id, user2Id })
    .onConflictDoNothing({
      target: [conversations.user1Id, conversations.user2Id],
    })

  const row = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(eq(conversations.user1Id, user1Id), eq(conversations.user2Id, user2Id)),
    )
    .limit(1)

  return row[0]!.id
}

/**
 * The viewer's conversation inbox, newest activity first. Fetches
 * conversations, other-participant profiles, last message per
 * conversation, and unread counts in parallel rather than joining
 * everything in one query — keeps each query simple and index-backed,
 * and the row counts here (a user's own conversation list) are small
 * enough that the extra round trips are cheap.
 */
export async function getConversations(
  viewerId: string,
): Promise<ConversationSummary[]> {
  const rows = await db
    .select({
      id: conversations.id,
      user1Id: conversations.user1Id,
      user2Id: conversations.user2Id,
      lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .where(
      or(eq(conversations.user1Id, viewerId), eq(conversations.user2Id, viewerId)),
    )
    .orderBy(desc(conversations.lastMessageAt))

  if (rows.length === 0) return []

  const conversationIds = rows.map((row) => row.id)
  const otherUserIds = rows.map((row) =>
    row.user1Id === viewerId ? row.user2Id : row.user1Id,
  )

  const [otherUsers, lastMessageRows, unreadRows] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
      })
      .from(user)
      .where(inArray(user.id, otherUserIds)),
    // DISTINCT ON picks one row per conversation — the newest, thanks
    // to the matching ORDER BY — so this is one indexed scan instead
    // of pulling every message just to find the latest in JS.
    // `${conversationIds}` isn't bound as a single Postgres array
    // value here — drizzle's sql template flattens a JS array
    // parameter into a parenthesized, comma-joined placeholder list
    // (the shape an `in` clause needs), so this must read `in`, not
    // `= any(...)` (which expects one array-typed parameter and
    // throws "malformed array literal" once it gets `in`'s list
    // syntax instead).
    db.execute<{
      conversationId: string
      content: string
      senderId: string
      createdAt: Date
    }>(
      sql`select distinct on ("conversationId") "conversationId", content, "senderId", "createdAt"
          from "messages"
          where "conversationId" in ${conversationIds}
          order by "conversationId", "createdAt" desc`,
    ),
    db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          eq(messages.isRead, false),
          ne(messages.senderId, viewerId),
        ),
      )
      .groupBy(messages.conversationId),
  ])

  const otherUserById = new Map(otherUsers.map((row) => [row.id, row]))
  const lastMessageByConversation = new Map(
    lastMessageRows.rows.map((row) => [row.conversationId, row]),
  )
  const unreadByConversation = new Map(
    unreadRows.map((row) => [row.conversationId, row.count]),
  )

  return rows.map((row) => {
    const otherUserId = row.user1Id === viewerId ? row.user2Id : row.user1Id
    const lastMessage = lastMessageByConversation.get(row.id)

    return {
      id: row.id,
      otherUser:
        otherUserById.get(otherUserId) ?? {
          id: otherUserId,
          name: "Unknown user",
          username: null,
          image: null,
        },
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          }
        : null,
      lastMessageAt: row.lastMessageAt,
      unreadCount: unreadByConversation.get(row.id) ?? 0,
    }
  })
}

/**
 * Loads a conversation for rendering, but only if `viewerId` is one of
 * its two participants. There is no RLS on Aurora, so this check is
 * the entire access-control boundary for the thread page and every
 * message action below — always route through this (or an equivalent
 * inline check) rather than trusting a conversation id from the URL.
 */
export async function getConversationForViewer(
  conversationId: string,
  viewerId: string,
): Promise<ConversationWithParticipant | null> {
  const rows = await db
    .select({
      id: conversations.id,
      user1Id: conversations.user1Id,
      user2Id: conversations.user2Id,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1)

  const conversation = rows[0]
  if (!conversation) return null
  if (conversation.user1Id !== viewerId && conversation.user2Id !== viewerId) {
    return null
  }

  const otherUserId =
    conversation.user1Id === viewerId ? conversation.user2Id : conversation.user1Id

  const otherUserRows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, otherUserId))
    .limit(1)

  if (!otherUserRows[0]) return null

  return { id: conversation.id, otherUser: otherUserRows[0] }
}

/** All messages in a conversation, oldest first. Caller must already
 * have verified the viewer is a participant (e.g. via
 * `getConversationForViewer`). */
export async function getMessages(
  conversationId: string,
): Promise<ThreadMessage[]> {
  return db
    .select({
      id: messages.id,
      conversationId: messages.conversationId,
      senderId: messages.senderId,
      content: messages.content,
      isRead: messages.isRead,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
}

/** Total unread messages across all of the viewer's conversations, for the nav badge. */
export async function getUnreadMessageCount(viewerId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        or(eq(conversations.user1Id, viewerId), eq(conversations.user2Id, viewerId)),
        eq(messages.isRead, false),
        ne(messages.senderId, viewerId),
      ),
    )

  return rows[0]?.count ?? 0
}

/**
 * Marks every message the *other* participant sent in this
 * conversation as read. Scoped to messages not sent by `viewerId` so
 * calling this never marks the viewer's own outgoing messages "read".
 */
export async function markConversationRead(
  conversationId: string,
  viewerId: string,
): Promise<void> {
  await db
    .update(messages)
    .set({ isRead: true })
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.isRead, false),
        ne(messages.senderId, viewerId),
      ),
    )
}
