import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parsePagination } from "@/lib/api/response"
import { getProfileByIdentifier } from "@/lib/follows"
import { getBlockedUserIds } from "@/lib/blocks"
import { getUserPosts } from "@/lib/posts"

/** GET /api/v1/users/[username]/posts — a user's top-level posts, newest first. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { username } = await params
  const profile = await getProfileByIdentifier(username)
  if (!profile) return apiError(404, "User not found.")

  const blocked = await getBlockedUserIds(auth.userId)
  if (blocked.has(profile.id)) return apiSuccess({ posts: [] })

  const { limit } = parsePagination(request)
  const posts = await getUserPosts(profile.id, auth.userId, limit)
  return apiSuccess({ posts })
}
