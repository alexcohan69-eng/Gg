import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiSuccess, parsePagination } from "@/lib/api/response"
import { getBookmarkedPosts } from "@/lib/posts"
import { getBlockedUserIds } from "@/lib/blocks"

/** GET /api/v1/bookmarks — the authenticated user's bookmarked posts. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const blocked = await getBlockedUserIds(auth.userId)
  const { limit } = parsePagination(request)
  const posts = await getBookmarkedPosts(auth.userId, blocked, limit)
  return apiSuccess({ posts })
}
