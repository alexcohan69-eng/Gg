import { authenticateApiRequest, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { parseLimit, requireProfileByUsername } from "@/lib/api-v1-helpers"
import { getUserPosts } from "@/lib/posts"

/**
 * GET /api/v1/users/:username/posts — a user's top-level posts, newest
 * first. No API key required; an optional one adds the caller's own
 * like/bookmark/repost state on each post.
 */
export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const { username } = await params
    const { userId: viewerId } = await authenticateApiRequest(request)
    const profile = await requireProfileByUsername(username)
    const limit = parseLimit(request)

    const posts = await getUserPosts(profile.id, viewerId ?? "", limit)
    return apiSuccess(posts)
  })
}
