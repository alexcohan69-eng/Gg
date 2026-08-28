import { and, asc, desc, eq, ilike, notInArray, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookmarks, follows, likes, posts, reposts, user } from "@/lib/db/schema"
import { feedBaseSelection, finalizeFeedPosts, withLikeAndRepostJoins, type FeedPost } from "@/lib/posts"
import type { FollowListUser } from "@/lib/follows"

const SEARCH_LIMIT = 20

function excludeUsersCondition(excludeUserIds: Set<string>) {
  return excludeUserIds.size > 0 ? notInArray(user.id, [...excludeUserIds]) : undefined
}

function excludeAuthorsCondition(excludeUserIds: Set<string>) {
  return excludeUserIds.size > 0
    ? notInArray(posts.userId, [...excludeUserIds])
    : undefined
}

/**
 * Escapes ILIKE's own wildcard characters so a literal "%" or "_" (or
 * a literal backslash) typed by the user is matched as text instead of
 * being interpreted as a pattern wildcard.
 */
function toSearchPattern(query: string) {
  const escaped = query.replace(/[\\%_]/g, (char) => `\\${char}`)
  return `%${escaped}%`
}

/**
 * Users whose display name or username contains `query` (case
 * insensitive, partial match anywhere in the string). Backed by GIN
 * trigram indexes on `user.name` / `user.username` so this stays fast
 * as the table grows. Shaped as `FollowListUser` so search results can
 * reuse `UserList` / `UserListItem` unchanged.
 */
export async function searchUsers(
  query: string,
  viewerId: string,
  excludeUserIds: Set<string> = new Set(),
  limit = SEARCH_LIMIT,
): Promise<FollowListUser[]> {
  const pattern = toSearchPattern(query)

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      about: user.about,
      image: user.image,
      bannerImage: user.bannerImage,
      website: user.website,
      location: user.location,
      createdAt: user.createdAt,
      isFollowedByViewer: sql<boolean>`${follows.id} is not null`,
    })
    .from(user)
    .leftJoin(
      follows,
      and(eq(follows.followerId, viewerId), eq(follows.followingId, user.id)),
    )
    .where(
      and(
        or(ilike(user.name, pattern), ilike(user.username, pattern)),
        excludeUsersCondition(excludeUserIds),
      ),
    )
    .orderBy(asc(user.name))
    .limit(limit)

  return rows.map((row) => ({
    ...row,
    isSelf: row.id === viewerId,
  }))
}

/**
 * Top-level posts (no replies) whose content contains `query`, newest
 * first, joined with the viewer's interaction state exactly like the
 * home/profile feeds. Backed by a GIN trigram index on `posts.content`.
 */
export async function searchPosts(
  query: string,
  viewerId: string,
  excludeUserIds: Set<string> = new Set(),
  limit = SEARCH_LIMIT,
): Promise<FeedPost[]> {
  const pattern = toSearchPattern(query)

  const searchQuery = db
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

  const rows = await withLikeAndRepostJoins(searchQuery, viewerId)
    .where(
      and(
        eq(posts.isReply, false),
        ilike(posts.content, pattern),
        excludeAuthorsCondition(excludeUserIds),
      ),
    )
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return finalizeFeedPosts(rows)
}
