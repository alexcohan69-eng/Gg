import { authenticateApiRequest, apiError, apiSuccess, requireApiUser, withApiErrorHandling } from "@/lib/api-auth"
import { parseLimit } from "@/lib/api-v1-helpers"
import { getFeedPosts } from "@/lib/posts"
import { createPostForUser, type PostActionResult } from "@/app/actions/posts"

/**
 * GET /api/v1/posts — the public chronological feed (top-level posts
 * only), newest first. No API key required; an optional one adds the
 * caller's own like/bookmark/repost state on each post.
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { userId: viewerId } = await authenticateApiRequest(request)
    const limit = parseLimit(request)
    const posts = await getFeedPosts(viewerId ?? "", new Set(), limit)
    return apiSuccess(posts)
  })
}

/**
 * POST /api/v1/posts — create a top-level post (or a reply, via
 * `replyToId`) as the authenticated key's own user. Requires an API
 * key. Reuses `createPost` from app/actions/posts.ts so validation and
 * ownership rules are identical to the web composer — this route just
 * supplies the userId via the API key's session instead of a cookie.
 */
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const formData = await request.formData()
    const result: PostActionResult = await createPostForUser(userId, formData)
    if (!result.success) {
      return apiError(400, "invalid_post", result.error ?? "Couldn't create post.")
    }
    return apiSuccess({ success: true }, 201)
  })
}
