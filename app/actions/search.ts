"use server"

import { headers } from "next/headers"
import { getSessionWithRetry } from "@/lib/auth"
import { searchPosts, searchUsers } from "@/lib/search"
import { getBlockedUserIds } from "@/lib/blocks"
import type { FeedPost } from "@/lib/posts"
import type { FollowListUser } from "@/lib/follows"

export type SearchResults = {
  users: FollowListUser[]
  posts: FeedPost[]
}

const MIN_QUERY_LENGTH = 1

/**
 * Runs the combined user + post search for the signed-in viewer. Called
 * directly from the client search input (debounced there), so this
 * intentionally stays cheap to invoke — auth check, trim, then two
 * indexed queries in parallel.
 */
export async function search(query: string): Promise<SearchResults> {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")

  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { users: [], posts: [] }
  }

  const blockedUserIds = await getBlockedUserIds(session.user.id)

  const [users, posts] = await Promise.all([
    searchUsers(trimmed, session.user.id, blockedUserIds),
    searchPosts(trimmed, session.user.id, blockedUserIds),
  ])

  return { users, posts }
}
