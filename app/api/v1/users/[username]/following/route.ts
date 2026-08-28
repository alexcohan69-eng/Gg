import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { getProfileByIdentifier, getFollowing } from "@/lib/follows"
import { getBlockedUserIds } from "@/lib/blocks"

/** GET /api/v1/users/[username]/following */
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
  const following = await getFollowing(profile.id, auth.userId, blocked)
  return apiSuccess({ following })
}
