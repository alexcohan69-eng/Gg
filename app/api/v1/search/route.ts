import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { searchPosts, searchUsers } from "@/lib/search"
import { getBlockedUserIds } from "@/lib/blocks"

/** GET /api/v1/search?q=... — searches users and posts. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim()
  if (!q) return apiError(400, "q query param is required.")

  const blocked = await getBlockedUserIds(auth.userId)
  const [users, posts] = await Promise.all([
    searchUsers(q, auth.userId, blocked),
    searchPosts(q, auth.userId, blocked),
  ])

  return apiSuccess({ users, posts })
}
