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
 * Compact preview of a service/portfolio project/testimonial that a
 * post links to via `posts.attachedServiceId`/`attachedProjectId`/
 * `attachedTestimonialId` — at most one of the three is ever set (see
 * lib/db/schema.ts). Lets `PostCard` render a rich preview card the
 * same way a link-unfurl would, without the client needing to know
 * anything about the linked table's shape.
 */
export type AttachedItemPreview = {
  type: "service" | "project" | "testimonial"
  id: string
  title: string
  subtitle: string | null
  image: string | null
  imageType: MediaType | null
  meta: string | null
}

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
  /** The linked service/project/testimonial preview, if any — see `AttachedItemPreview`. */
  attachment: AttachedItemPreview | null
}

/** Raw feed post row shape as it comes back from the query, before media parsing and attachment resolution. */
type RawFeedPostRow = Omit<FeedPost, "media" | "attachment"> & {
  media: string | null
  attachedServiceId: string | null
  attachedProjectId: string | null
  attachedTestimonialId: string | null
}

/**
 * Batch-loads the `AttachedItemPreview` for every distinct
 * service/project/testimonial referenced across a page of rows, keyed
 * by `"<type>:<id>"`. One round trip per linked table regardless of how
 * many posts reference it, instead of a per-post lookup.
 */
async function loadAttachmentPreviews(
  rows: Pick<RawFeedPostRow, "attachedServiceId" | "attachedProjectId" | "attachedTestimonialId">[],
): Promise<Map<string, AttachedItemPreview>> {
  const serviceIds = [...new Set(rows.map((r) => r.attachedServiceId).filter((id): id is string => id !== null))]
  const projectIds = [...new Set(rows.map((r) => r.attachedProjectId).filter((id): id is string => id !== null))]
  const testimonialIds = [
    ...new Set(rows.map((r) => r.attachedTestimonialId).filter((id): id is string => id !== null)),
  ]

  const previews = new Map<string, AttachedItemPreview>()
  if (serviceIds.length === 0 && projectIds.length === 0 && testimonialIds.length === 0) {
    return previews
  }

  const [serviceRows, projectRows, testimonialRows] = await Promise.all([
    serviceIds.length > 0
      ? db
          .select({
            id: services.id,
            title: services.title,
            tagline: services.tagline,
            coverImage: services.coverImage,
            coverImageType: services.coverImageType,
            startingPrice: services.startingPrice,
            deliveryDays: services.deliveryDays,
          })
          .from(services)
          .where(inArray(services.id, serviceIds))
      : Promise.resolve([]),
    projectIds.length > 0
      ? db
          .select({
            id: portfolioProjects.id,
            title: portfolioProjects.title,
            tagline: portfolioProjects.tagline,
            coverImage: portfolioProjects.coverImage,
            coverImageType: portfolioProjects.coverImageType,
            client: portfolioProjects.client,
          })
          .from(portfolioProjects)
          .where(inArray(portfolioProjects.id, projectIds))
      : Promise.resolve([]),
    testimonialIds.length > 0
      ? db
          .select({
            id: testimonials.id,
            authorName: testimonials.authorName,
            authorAvatar: testimonials.authorAvatar,
            rating: testimonials.rating,
            content: testimonials.content,
            projectTitle: testimonials.projectTitle,
          })
          .from(testimonials)
          .where(inArray(testimonials.id, testimonialIds))
      : Promise.resolve([]),
  ])

  for (const row of serviceRows) {
    previews.set(`service:${row.id}`, {
      type: "service",
      id: row.id,
      title: row.title,
      subtitle: row.tagline,
      image: row.coverImage,
      imageType: (row.coverImageType as MediaType | null) ?? "image",
      meta: `From $${row.startingPrice.toLocaleString()} · ${row.deliveryDays} ${row.deliveryDays === 1 ? "day" : "days"}`,
    })
  }
  for (const row of projectRows) {
    previews.set(`project:${row.id}`, {
      type: "project",
      id: row.id,
      title: row.title,
      subtitle: row.tagline,
      image: row.coverImage,
      imageType: (row.coverImageType as MediaType | null) ?? "image",
      meta: row.client ? `Client: ${row.client}` : null,
    })
  }
  for (const row of testimonialRows) {
    previews.set(`testimonial:${row.id}`, {
      type: "testimonial",
      id: row.id,
      title: row.authorName,
      subtitle: row.projectTitle ?? stripHtmlToText(row.content).slice(0, 140),
      image: row.authorAvatar,
      imageType: "image",
      meta: row.rating ? `${row.rating} out of 5 stars` : null,
    })
  }

  return previews
}

/**
 * `posts.media` comes back from the query as the raw JSON-encoded TEXT
 * column (Aurora DSQL has no JSON/JSONB type), and the attached-item
 * columns are plain foreign-id text columns — every feed query below
 * runs its rows through this before returning so callers only ever see
 * the parsed `MediaAttachment[] | null` media shape plus a resolved
 * `attachment` preview.
 */
export async function finalizeFeedPosts(rows: RawFeedPostRow[]): Promise<FeedPost[]> {
  const previews = await loadAttachmentPreviews(rows)

  return rows.map((row) => {
    const { attachedServiceId, attachedProjectId, attachedTestimonialId, media, ...rest } = row
    const key = attachedServiceId
      ? `service:${attachedServiceId}`
      : attachedProjectId
        ? `project:${attachedProjectId}`
        : attachedTestimonialId
          ? `testimonial:${attachedTestimonialId}`
          : null
    const parsedMedia = parseMediaColumn(media)
    return {
      ...rest,
      media: parsedMedia.length > 0 ? parsedMedia : null,
      attachment: key ? previews.get(key) ?? null : null,
    }
  })
}

const FEED_PAGE_SIZE = 30

export const feedBaseSelection = {
  id: posts.id,
  content: posts.content,
  media: posts.media,
  createdAt: posts.createdAt,
  likeCount: posts.likeCount,
  replyCount: posts.replyCount,
  repostCount: posts.repostCount,
  replyToId: posts.replyToId,
  attachedServiceId: posts.attachedServiceId,
  attachedProjectId: posts.attachedProjectId,
  attachedTestimonialId: posts.attachedTestimonialId,
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

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(and(eq(posts.isReply, false), excludeAuthorsCondition(excludeUserIds)))
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return finalizeFeedPosts(rows)
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

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(
      and(
        eq(posts.isReply, false),
        inArray(posts.userId, authorIds),
        excludeAuthorsCondition(excludeUserIds),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return finalizeFeedPosts(rows)
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

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(and(eq(posts.userId, userId), eq(posts.isReply, false)))
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return finalizeFeedPosts(rows)
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

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(and(eq(bookmarks.userId, viewerId), excludeAuthorsCondition(excludeUserIds)))
    .orderBy(desc(bookmarks.createdAt))
    .limit(limit)

  return finalizeFeedPosts(rows)
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

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(eq(posts.id, postId))
    .limit(1)

  if (!rows[0]) return null
  const [post] = await finalizeFeedPosts(rows)
  return post ?? null
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

  const rows = await withLikeAndRepostJoins(query, viewerId)
    .where(and(eq(posts.replyToId, postId), excludeAuthorsCondition(excludeUserIds)))
    .orderBy(asc(posts.createdAt))
    .limit(limit)

  return finalizeFeedPosts(rows)
}
