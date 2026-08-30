import { authenticateApiRequest, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { requireProfileByUsername } from "@/lib/api-v1-helpers"
import { getFollowCounts, isFollowing } from "@/lib/follows"

/**
 * GET /api/v1/users/:username — public profile lookup. No API key
 * required; an optional one only adds `isFollowedByViewer`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const { username } = await params
    const { userId: viewerId } = await authenticateApiRequest(request)
    const profile = await requireProfileByUsername(username)
    const counts = await getFollowCounts(profile.id)
    const isFollowedByViewer = viewerId ? await isFollowing(viewerId, profile.id) : false

    return apiSuccess({
      ...profile,
      followerCount: counts.followers,
      followingCount: counts.following,
      isFollowedByViewer,
    })
  })
}
