import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { getProfileByIdentifier, getFollowers } from "@/lib/follows"
import { getBlockedUserIds } from "@/lib/blocks"

/** GET /api/v1/users/[username]/followers */
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
  const followers = await getFollowers(profile.id, auth.userId, blocked)
  return apiSuccess({ followers })
}
