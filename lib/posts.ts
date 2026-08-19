import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookmarks, follows, likes, posts, reposts, user } from "@/lib/db/schema"
import type { MediaAttachment } from "@/lib/media"

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
  media: MediaAttachment[] | null
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
  /**
   * The timestamp this row is ordered by in whichever list it came
   * from — `createdAt` for every feed except bookmarks, where it's the
   * bookmark's own `createdAt`. "Load more" cursors on this field
   * instead of `createdAt` so paging through bookmarks stays correct
   * even though its sort order isn't the post's creation time.
   */
  sortKey: Date
}

/**
 * Exported so callers (the "load more" server actions and the client
 * `PostFeed` component) can tell whether a page came back full — the
 * signal that there might be another page after it — without
 * duplicating this number.
 */
export const FEED_PAGE_SIZE = 30

export const feedBaseSelection = {
  id: posts.id,
  content: posts.content,
  media: posts.media,
  createdAt: posts.createdAt,
  // Default pagination cursor — every query below overrides this with
  // its own actual sort column when that differs (only `bookmarks` needs to).
  sortKey: posts.createdAt,
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
export function withLikeAndRepostJoins(query: any, viewerId: string) {
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
 * Global chronological timeline (top-level posts only), for the "For
 * you" home tab. See `getFollowingFeed` for the follows-scoped variant
 * behind the "Following" tab.
 */
export async function getFeedPosts(
  viewerId: string,
  limit = FEED_PAGE_SIZE,
  /** When set, only posts older than this (for "load more") are returned. */
  before?: Date,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...feedBaseSelection,
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
    .where(
      and(
        eq(posts.isReply, false),
        before ? lt(posts.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}

/**
 * Chronological timeline scoped to accounts the viewer follows, plus
 * the viewer's own posts (top-level posts only), for the "Following"
 * home tab. The follow graph is small enough per-viewer to resolve the
 * id list in one query and filter with `inArray` rather than a joined
 * subquery — keeps this symmetric with the other feed queries above.
 */
export async function getFollowingFeed(
  viewerId: string,
  limit = FEED_PAGE_SIZE,
  before?: Date,
): Promise<FeedPost[]> {
  const followingRows = await db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))

  const authorIds = [viewerId, ...followingRows.map((row) => row.followingId)]

  const query = db
    .select({
      ...feedBaseSelection,
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
    .where(
      and(
        eq(posts.isReply, false),
        inArray(posts.userId, authorIds),
        before ? lt(posts.createdAt, before) : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}

/** Top-level posts authored by a single user, newest first. */
export async function getUserPosts(
  userId: string,
  viewerId: string,
  limit = FEED_PAGE_SIZE,
  before?: Date,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...feedBaseSelection,
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
    .where(
      and(
        eq(posts.userId, userId),
        eq(posts.isReply, false),
        before ? lt(posts.createdAt, before) : undefined,
      ),
    )
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
  /** Cursor is the bookmark's own `createdAt`, not the post's. */
  before?: Date,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...feedBaseSelection,
      // Override the default (post's createdAt): this list is ordered
      // by when the viewer bookmarked the post, not when it was posted.
      sortKey: bookmarks.createdAt,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`true`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .innerJoin(user, eq(posts.userId, user.id))

  return withLikeAndRepostJoins(query, viewerId)
    .where(
      and(
        eq(bookmarks.userId, viewerId),
        before ? lt(bookmarks.createdAt, before) : undefined,
      ),
    )
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
      ...feedBaseSelection,
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
      ...feedBaseSelection,
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
