import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { getProfileByIdentifier, getFollowCounts, isFollowing } from "@/lib/follows"
import { getBlockState } from "@/lib/blocks"
import { getUserPostCount } from "@/lib/posts"

/** GET /api/v1/users/[username] — public profile lookup by username or id. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { username } = await params
  const profile = await getProfileByIdentifier(username)
  if (!profile) return apiError(404, "User not found.")

  const blockState = await getBlockState(auth.userId, profile.id)
  if (blockState.targetBlockedViewer) {
    return apiError(404, "User not found.")
  }

  const [counts, postCount, viewerFollows] = await Promise.all([
    getFollowCounts(profile.id),
    getUserPostCount(profile.id),
    isFollowing(auth.userId, profile.id),
  ])

  return apiSuccess({
    user: {
      ...profile,
      followerCount: counts.followers,
      followingCount: counts.following,
      postCount,
      isFollowedByViewer: viewerFollows,
      isBlockedByViewer: blockState.viewerBlockedTarget,
    },
  })
}
