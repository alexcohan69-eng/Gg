"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  getBookmarkedPosts,
  getFeedPosts,
  getFollowingFeed,
  getUserPosts,
  type FeedPost,
} from "@/lib/posts"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

/**
 * "Load more" for the home feed's "For you" tab. Bound to `before`
 * only — the client supplies the last loaded post's `sortKey` as the
 * cursor — so `PostFeed` can call every feed's load-more action with
 * the same one-argument shape.
 */
export async function loadMoreHomeFeed(before: Date): Promise<FeedPost[]> {
  const viewerId = await getUserId()
  return getFeedPosts(viewerId, undefined, before)
}

/** "Load more" for the home feed's "Following" tab. */
export async function loadMoreFollowingFeed(before: Date): Promise<FeedPost[]> {
  const viewerId = await getUserId()
  return getFollowingFeed(viewerId, undefined, before)
}

/**
 * "Load more" for a profile's posts tab. `userId` is pre-bound by the
 * page (via `.bind(null, userId)`) since it's fixed for a given
 * profile — only `before` varies per call from the client.
 */
export async function loadMoreProfilePosts(
  userId: string,
  before: Date,
): Promise<FeedPost[]> {
  const viewerId = await getUserId()
  return getUserPosts(userId, viewerId, undefined, before)
}

/** "Load more" for the viewer's bookmarks tab. */
export async function loadMoreBookmarks(before: Date): Promise<FeedPost[]> {
  const viewerId = await getUserId()
  return getBookmarkedPosts(viewerId, undefined, before)
}
