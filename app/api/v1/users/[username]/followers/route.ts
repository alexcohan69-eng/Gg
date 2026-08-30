import { authenticateApiRequest, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { requireProfileByUsername } from "@/lib/api-v1-helpers"
import { getFollowers } from "@/lib/follows"

/** GET /api/v1/users/:username/followers — public list, no API key required. */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const { username } = await params
    const { userId: viewerId } = await authenticateApiRequest(request)
    const profile = await requireProfileByUsername(username)

    const followers = await getFollowers(profile.id, viewerId ?? "")
    return apiSuccess(followers)
  })
}
