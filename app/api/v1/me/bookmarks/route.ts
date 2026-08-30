import { requireApiUser, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getBookmarkedPosts } from "@/lib/posts"
import { getBlockedUserIds } from "@/lib/blocks"

/**
 * GET /api/v1/me/bookmarks — the authenticated key's own bookmarked
 * posts, newest first. Requires a valid API key — bookmarks are
 * always private to their owner, unlike public post/profile reads.
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const blockedUserIds = await getBlockedUserIds(userId)
    const posts = await getBookmarkedPosts(userId, blockedUserIds)
    return apiSuccess(posts)
  })
}
