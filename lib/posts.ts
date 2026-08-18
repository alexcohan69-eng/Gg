import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { posts, user } from "@/lib/db/schema"

/**
 * A post joined with its author's public profile fields. This shape is
 * shared by the home feed and the profile posts tab so `PostList` /
 * `PostCard` only need to know about one type.
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
}

const FEED_PAGE_SIZE = 30

const postSelection = {
  id: posts.id,
  content: posts.content,
  imageUrls: posts.imageUrls,
  createdAt: posts.createdAt,
  likeCount: posts.likeCount,
  replyCount: posts.replyCount,
  repostCount: posts.repostCount,
  authorId: posts.userId,
  authorName: user.name,
  authorUsername: user.username,
  authorImage: user.image,
}

/**
 * Global chronological timeline (top-level posts only). There is no
 * follow graph wired up yet, so "home" shows every post — this is the
 * seam to add a follows-scoped query once that ships.
 */
export async function getFeedPosts(
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  return db
    .select(postSelection)
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .where(eq(posts.isReply, false))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}

/** Top-level posts authored by a single user, newest first. */
export async function getUserPosts(
  userId: string,
  limit = FEED_PAGE_SIZE,
): Promise<FeedPost[]> {
  return db
    .select(postSelection)
    .from(posts)
    .innerJoin(user, eq(posts.userId, user.id))
    .where(and(eq(posts.userId, userId), eq(posts.isReply, false)))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
}
