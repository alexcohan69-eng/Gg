import { and, desc, eq, gte, ne, notInArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookmarks, follows, likes, posts, reposts, user } from "@/lib/db/schema"
import { feedBaseSelection, withLikeAndRepostJoins, type FeedPost } from "@/lib/posts"
import type { FollowListUser } from "@/lib/follows"

const TRENDING_LIMIT = 6
const TRENDING_LOOKBACK_DAYS = 14
// Below this many candidates in the recent window, the "trending" list
// would look sparse/arbitrary, so fall back to an all-time ranking
// instead (matters most for a young app with little recent activity).
const TRENDING_MIN_RECENT_RESULTS = 3

const SUGGESTED_USERS_LIMIT = 5

/**
 * Simple weighted engagement score: replies count for more than likes
 * since they represent active back-and-forth, reposts count most since
 * they spread a post to a new audience. Intentionally just arithmetic
 * over columns already denormalized onto `posts` (no joins, no extra
 * aggregation) so this stays cheap to compute and easy to reason about.
 */
const trendingScore = sql<number>`(${posts.likeCount} + ${posts.repostCount} * 2 + ${posts.replyCount} * 1.5)`

async function fetchTrendingPosts(viewerId: string, limit: number, cutoff: Date | null) {
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

  const conditions = [eq(posts.isReply, false), sql`${trendingScore} > 0`]
  if (cutoff) conditions.push(gte(posts.createdAt, cutoff))

  return withLikeAndRepostJoins(query, viewerId)
    .where(and(...conditions))
    .orderBy(desc(trendingScore), desc(posts.createdAt))
    .limit(limit)
}

/**
 * Lightweight "trending" ranking for the Explore page: top-level posts
 * from the last `TRENDING_LOOKBACK_DAYS` days ordered by a simple
 * engagement score, newest first as a tiebreaker. Falls back to an
 * all-time ranking when the recent window doesn't have enough
 * candidates, so the section doesn't look empty or arbitrary on a
 * quiet/young instance. No new indexes required — reuses the existing
 * `posts_createdAt_idx` for the recency filter.
 */
export async function getTrendingPosts(
  viewerId: string,
  limit = TRENDING_LIMIT,
): Promise<FeedPost[]> {
  const cutoff = new Date(Date.now() - TRENDING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

  const recent = await fetchTrendingPosts(viewerId, limit, cutoff)
  if (recent.length >= Math.min(limit, TRENDING_MIN_RECENT_RESULTS)) {
    return recent
  }

  return fetchTrendingPosts(viewerId, limit, null)
}

/**
 * "Who to follow": accounts the viewer doesn't already follow (and
 * isn't themselves), ranked by follower count as a cheap popularity
 * signal, then by newest account as a tiebreaker so recently joined
 * users still surface. Reuses `follows_followingId_idx` for the count
 * and the follower-exclusion subquery. Good enough at this scale; a
 * denormalized follower-count column would be the next step if the
 * `follows` table grows large enough for the live count to get slow.
 */
export async function getSuggestedUsers(
  viewerId: string,
  limit = SUGGESTED_USERS_LIMIT,
): Promise<FollowListUser[]> {
  const followerCount = sql<number>`count(${follows.id})::int`

  const alreadyFollowing = db
    .select({ followingId: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, viewerId))

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      image: user.image,
      bannerImage: user.bannerImage,
      website: user.website,
      location: user.location,
      createdAt: user.createdAt,
    })
    .from(user)
    .leftJoin(follows, eq(follows.followingId, user.id))
    .where(and(ne(user.id, viewerId), notInArray(user.id, alreadyFollowing)))
    .groupBy(user.id)
    .orderBy(desc(followerCount), desc(user.createdAt))
    .limit(limit)

  return rows.map((row) => ({
    ...row,
    isFollowedByViewer: false,
    isSelf: false,
  }))
}
