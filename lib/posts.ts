import { cache } from "react"
import { and, asc, count, desc, eq, gt, inArray, notInArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  bookmarks,
  follows,
  likes,
  portfolioProjects,
  posts,
  reposts,
  services,
  testimonials,
  user,
} from "@/lib/db/schema"
import { parseMediaColumn, type MediaAttachment, type MediaType } from "@/lib/media"
import { stripHtmlToText } from "@/lib/sanitize-html"

/**
 * `notInArray` with an empty list isn't a no-op filter in SQL (it can
 * behave unexpectedly across drivers), so every call site below skips
 * adding the condition entirely when there's nothing to exclude.
 */
function excludeAuthorsCondition(excludeUserIds: Set<string>) {
  return excludeUserIds.size > 0
    ? notInArray(posts.userId, [...excludeUserIds])
    : undefined
}

/**
 * A post can embed a compact preview card linking back to one of the
 * author's own services/portfolioProjects/testimonials rows (see the
 * `attached*Id` columns on `posts`). At most one of the three ids is
 * ever set, so this is a discriminated union rather than three
 * separate optional fields.
 */
export type AttachedItem =
  | {
      kind: "service"
      id: string
      title: string
      tagline: string
      coverImage: string | null
      coverImageType: MediaType
      startingPrice: number
      deliveryDays: number
    }
  | {
      kind: "project"
      id: string
      title: string
      tagline: string
      coverImage: string | null
      coverImageType: MediaType
    }
  | {
      kind: "testimonial"
      id: string
      authorName: string
      authorAvatar: string | null
      rating: number | null
      content: string
    }

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
  attached: AttachedItem | null
}

/**
 * Raw shape of the three possibly-joined attachment tables, as they
 * come back nested in the query result — every leaf is null when that
 * table's left join didn't match (i.e. the post doesn't attach that
 * kind, or its target row was deleted).
 */
type RawAttachmentJoins = {
  attachedService: {
    id: string | null
    title: string | null
    tagline: string | null
    coverImage: string | null
    coverImageType: string | null
    startingPrice: number | null
    deliveryDays: number | null
  }
  attachedProject: {
    id: string | null
    title: string | null
    tagline: string | null
    coverImage: string | null
    coverImageType: string | null
  }
  attachedTestimonial: {
    id: string | null
    authorName: string | null
    authorAvatar: string | null
    rating: number | null
    content: string | null
  }
}

/** Raw feed post row shape as it comes back from the query, before media parsing. */
type RawFeedPostRow = Omit<FeedPost, "media" | "attached"> &
  RawAttachmentJoins & { media: string | null }

/**
 * Assembles the `attached` union from the three left-joined tables —
 * at most one of them ever has a non-null `id`, since at most one of
 * `attachedServiceId`/`attachedProjectId`/`attachedTestimonialId` is
 * ever set on the post row itself.
 */
function buildAttachedItem(row: RawAttachmentJoins): AttachedItem | null {
  if (row.attachedService.id) {
    return {
      kind: "service",
      id: row.attachedService.id,
      title: row.attachedService.title ?? "",
      tagline: row.attachedService.tagline ?? "",
      coverImage: row.attachedService.coverImage,
      coverImageType: (row.attachedService.coverImageType as MediaType | null) ?? "image",
      startingPrice: row.attachedService.startingPrice ?? 0,
      deliveryDays: row.attachedService.deliveryDays ?? 0,
    }
  }
  if (row.attachedProject.id) {
    return {
      kind: "project",
      id: row.attachedProject.id,
      title: row.attachedProject.title ?? "",
      tagline: row.attachedProject.tagline ?? "",
      coverImage: row.attachedProject.coverImage,
      coverImageType: (row.attachedProject.coverImageType as MediaType | null) ?? "image",
    }
  }
  if (row.attachedTestimonial.id) {
    return {
      kind: "testimonial",
      id: row.attachedTestimonial.id,
      authorName: row.attachedTestimonial.authorName ?? "",
      authorAvatar: row.attachedTestimonial.authorAvatar,
      rating: row.attachedTestimonial.rating,
      content: stripHtmlToText(row.attachedTestimonial.content ?? ""),
    }
  }
  return null
}

/**
 * `posts.media` comes back from the query as the raw JSON-encoded TEXT
 * column (Aurora DSQL has no JSON/JSONB type) — every feed query below
 * runs its rows through this before returning so callers only ever see
 * the parsed `MediaAttachment[] | null` shape.
 */
function parseFeedPostRow(row: RawFeedPostRow): FeedPost {
  const media = parseMediaColumn(row.media)
  return { ...row, media: media.length > 0 ? media : null, attached: buildAttachedItem(row) }
}

function parseFeedPostRows(rows: RawFeedPostRow[]): FeedPost[] {
  return rows.map(parseFeedPostRow)
}

const FEED_PAGE_SIZE = 30

/**
 * Nested selection for the three possibly-attached tables — Drizzle
 * groups these under their own key in the result row (matching
 * `RawAttachmentJoins`), which is what makes `buildAttachedItem` able
 * to read them back out as one coherent object per kind.
 */
const attachedSelection = {
  attachedService: {
    id: services.id,
    title: services.title,
    tagline: services.tagline,
    coverImage: services.coverImage,
    coverImageType: services.coverImageType,
    startingPrice: services.startingPrice,
    deliveryDays: services.deliveryDays,
  },
  attachedProject: {
    id: portfolioProjects.id,
    title: portfolioProjects.title,
    tagline: portfolioProjects.tagline,
    coverImage: portfolioProjects.coverImage,
    coverImageType: portfolioProjects.coverImageType,
  },
  attachedTestimonial: {
    id: testimonials.id,
    authorName: testimonials.authorName,
    authorAvatar: testimonials.authorAvatar,
    rating: testimonials.rating,
    content: testimonials.content,
  },
} as const

export const feedBaseSelection = {
  id: posts.id,
  content: posts.content,
  media: posts.media,
  createdAt: posts.createdAt,
  likeCount: posts.likeCount,
  replyCount: posts.replyCount,
  repostCount: posts.repostCount,
  replyToId: posts.replyToId,
  authorId: posts.userId,
  authorName: user.name,
  authorUsername: user.username,
  authorImage: user.image,
  ...attachedSelection,
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
 * Left-joins the (at most one) service/project/testimonial a post
 * attaches, so `feedBaseSelection`'s nested `attachedService`/
 * `attachedProject`/`attachedTestimonial` fields can be read back into
 * one `AttachedItem` by `buildAttachedItem`. A deleted target row just
 * leaves every leaf null, same as a post with no attachment at all.
 */
export function withAttachmentJoins(query: any) {
  return query
    .leftJoin(services, eq(posts.attachedServiceId, services.id))
    .leftJoin(portfolioProjects, eq(posts.attachedProjectId, portfolioProjects.id))
    .leftJoin(testimonials, eq(posts.attachedTestimonialId, testimonials.id))
}

/**
 * Global chronological timeline (top-level posts only), for the "For
 * you" home tab. See `getFollowingFeed` for the follows-scoped variant
 * behind the "Following" tab.
 */
export async function getFeedPosts(
  viewerId: string,
  excludeUserIds: Set<string> = new Set(),
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

  const rows = await withAttachmentJoins(withLikeAndRepostJoins(query, viewerId))
    .where(and(eq(posts.isReply, false), excludeAuthorsCondition(excludeUserIds)))
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return parseFeedPostRows(rows)
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
  excludeUserIds: Set<string> = new Set(),
  limit = FEED_PAGE_SIZE,
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

  const rows = await withAttachmentJoins(withLikeAndRepostJoins(query, viewerId))
    .where(
      and(
        eq(posts.isReply, false),
        inArray(posts.userId, authorIds),
        excludeAuthorsCondition(excludeUserIds),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return parseFeedPostRows(rows)
}

/**
 * Count of top-level posts newer than `since` that would appear in the
 * given home feed scope for this viewer. Backs the "Show N new posts"
 * banner — the banner polls this cheap count instead of the full feed
 * query, and only replaces the rendered list once the viewer opts in,
 * so an in-progress read/scroll never gets yanked out from under them.
 */
export async function getNewPostsCount(
  viewerId: string,
  scope: "for-you" | "following",
  since: Date,
  excludeUserIds: Set<string> = new Set(),
): Promise<number> {
  const excludeCondition = excludeAuthorsCondition(excludeUserIds)

  if (scope === "following") {
    const followingRows = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, viewerId))
    const authorIds = [viewerId, ...followingRows.map((row) => row.followingId)]

    const [row] = await db
      .select({ value: count() })
      .from(posts)
      .where(
        and(
          eq(posts.isReply, false),
          inArray(posts.userId, authorIds),
          gt(posts.createdAt, since),
          excludeCondition,
        ),
      )
    return row?.value ?? 0
  }

  const [row] = await db
    .select({ value: count() })
    .from(posts)
    .where(and(eq(posts.isReply, false), gt(posts.createdAt, since), excludeCondition))
  return row?.value ?? 0
}

/** Total number of top-level posts (i.e. not replies) authored by a user, for profile stats. */
export async function getUserPostCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(posts)
    .where(and(eq(posts.userId, userId), eq(posts.isReply, false)))
  return row?.value ?? 0
}

/** Top-level posts authored by a single user, newest first. */
export async function getUserPosts(
  userId: string,
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

  const rows = await withAttachmentJoins(withLikeAndRepostJoins(query, viewerId))
    .where(and(eq(posts.userId, userId), eq(posts.isReply, false)))
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return parseFeedPostRows(rows)
}

/**
 * Posts the viewer has bookmarked, newest bookmark first. The base
 * table here IS the viewer's bookmarks (already filtered to their own
 * rows), so `isBookmarked` is trivially true — no need to re-join
 * `bookmarks` a second time.
 */
export async function getBookmarkedPosts(
  viewerId: string,
  excludeUserIds: Set<string> = new Set(),
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  const query = db
    .select({
      ...feedBaseSelection,
      isLiked: sql<boolean>`${likes.id} is not null`,
      isBookmarked: sql<boolean>`true`,
      isReposted: sql<boolean>`${reposts.id} is not null`,
    })
    .from(bookmarks)
    .innerJoin(posts, eq(bookmarks.postId, posts.id))
    .innerJoin(user, eq(posts.userId, user.id))

  const rows = await withAttachmentJoins(withLikeAndRepostJoins(query, viewerId))
    .where(and(eq(bookmarks.userId, viewerId), excludeAuthorsCondition(excludeUserIds)))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit)

  return parseFeedPostRows(rows)
}

/**
 * A single post by id, joined with the viewer's interaction state. Used
 * by the post detail/thread page to render the post being viewed —
 * whether it's a top-level post or itself a reply, so nested threads
 * can be opened one level at a time.
 *
 * Wrapped in `cache()` because the post detail page's
 * `generateMetadata` and the page body both fetch the same post once
 * per request — memoizing collapses that back down to a single query.
 */
export const getPostById = cache(async function getPostById(
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

  const rows = await withAttachmentJoins(withLikeAndRepostJoins(query, viewerId))
    .where(eq(posts.id, postId))
    .limit(1)

  return rows[0] ? parseFeedPostRow(rows[0]) : null
})

/**
 * Direct replies to a post, oldest first so the conversation reads
 * top-to-bottom like a thread. Each reply is itself a normal `posts`
 * row (via `replyToId`), so this same query works at any depth — the
 * detail page just re-runs it for whichever post id is being viewed.
 */
export async function getPostReplies(
  postId: string,
  viewerId: string,
  excludeUserIds: Set<string> = new Set(),
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

  const rows = await withAttachmentJoins(withLikeAndRepostJoins(query, viewerId))
    .where(and(eq(posts.replyToId, postId), excludeAuthorsCondition(excludeUserIds)))
    .orderBy(asc(posts.createdAt))
    .limit(limit)

  return parseFeedPostRows(rows)
}
