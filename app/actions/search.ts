"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { searchPosts, searchUsers } from "@/lib/search"
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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")

  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { users: [], posts: [] }
  }

  const [users, posts] = await Promise.all([
    searchUsers(trimmed, session.user.id),
    searchPosts(trimmed, session.user.id),
  ])

  return { users, posts }
}
