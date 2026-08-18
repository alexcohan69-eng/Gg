import { and, asc, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookmarks, likes, posts, reposts, user } from "@/lib/db/schema"

/**
 * A post joined with its author's public profile fields plus the
 * viewer's interaction state (like/bookmark/repost). This shape is
 * shared by the home feed, profile posts tab, bookmarks tab, and the
 * post detail/thread view so `PostList` / `PostCard` only need to know
 * about one type.
 */
export type FeedPost = {
  id: string
  content: string
  imageUrls: string[] | null
  createdAt: Date
  likeCount: number
  replyCount: number
  repostCount: number
  authorId: string
  authorName: string
  authorUsername: string | null
  authorImage: string | null
  isLiked: boolean
  isBookmarked: boolean
  isReposted: boolean
  replyToId: string | null
}

const FEED_PAGE_SIZE = 30

const baseSelection = {
  id: posts.id,
  content: posts.content,
  imageUrls: posts.imageUrls,
  createdAt: posts.createdAt,
  likeCount: posts.likeCount,
  replyCount: posts.replyCount,
  repostCount: posts.repostCount,
  replyToId: posts.replyToId,
  authorId: posts.userId,
  authorName: user.name,
  authorUsername: user.username,
  authorImage: user.image,
} as const

/**
 * Left-joins the viewer's own like/repost rows onto a posts query so
 * each row carries that viewer's interaction state. The unique
 * (userId, postId) index on each table guarantees at most one matching
 * row, so this never fans out the result set.
 */
function withLikeAndRepostJoins(query: any, viewerId: string) {
  return query
    .leftJoin(
      likes,
      and(eq(likes.postId, posts.id), eq(likes.userId, viewerId)),
    )
    .leftJoin(
      reposts,
      and(eq(reposts.postId, posts.id), eq(reposts.userId, viewerId)),
    )
}

/**
 * Global chronological timeline (top-level posts only). There is no
 * follow graph wired up yet, so "home" shows every post — this is the
 * seam to add a follows-scoped query once that ships.
 */
export async function getFeedPosts(
  viewerId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...baseSelection,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`${bookmarks.id} is not null`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, viewerId)),
    )

  return withLikeAndRepostJoins(query, viewerId)
    .where(eq(posts.isReply, false))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}

/** Top-level posts authored by a single user, newest first. */
export async function getUserPosts(
  userId: string,
  viewerId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...baseSelection,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`${bookmarks.id} is not null`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, viewerId)),
    )

  return withLikeAndRepostJoins(query, viewerId)
    .where(and(eq(posts.userId, userId), eq(posts.isReply, false)))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}

/**
 * Posts the viewer has bookmarked, newest bookmark first. The base
 * table here IS the viewer's bookmarks (already filtered to their own
 * rows), so `isBookmarked` is trivially true — no need to re-join
 * `bookmarks` a second time.
 */
export async function getBookmarkedPosts(
  viewerId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...baseSelection,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`true`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .innerJoin(user, eq(posts.userId, user.id))

  return withLikeAndRepostJoins(query, viewerId)
    .where(eq(bookmarks.userId, viewerId))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit)
}

/**
 * A single post by id, joined with the viewer's interaction state. Used
 * by the post detail/thread page to render the post being viewed —
 * whether it's a top-level post or itself a reply, so nested threads
 * can be opened one level at a time.
 */
export async function getPostById(
  postId: string,
  viewerId: string,
): Promise<FeedPost | null> {
  const query = db
    .select({
      ...baseSelection,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`${bookmarks.id} is not null`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, viewerId)),
    )

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(eq(posts.id, postId))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Direct replies to a post, oldest first so the conversation reads
 * top-to-bottom like a thread. Each reply is itself a normal `posts`
 * row (via `replyToId`), so this same query works at any depth — the
 * detail page just re-runs it for whichever post id is being viewed.
 */
export async function getPostReplies(
  postId: string,
  viewerId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...baseSelection,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`${bookmarks.id} is not null`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .leftJoin(
      bookmarks,
      and(eq(bookmarks.postId, posts.id), eq(bookmarks.userId, viewerId)),
    )

  return withLikeAndRepostJoins(query, viewerId)
    .where(eq(posts.replyToId, postId))
    .orderBy(asc(posts.createdAt))
    .limit(limit)
}
