import { authenticateApiRequest, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { parseLimit } from "@/lib/api-v1-helpers"
import { searchPosts, searchUsers } from "@/lib/search"

/**
 * GET /api/v1/search?q=...&type=users|posts — searches public users or
 * posts (default: users). No API key required; an optional one adds
 * viewer-specific flags to the results.
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { userId: viewerId } = await authenticateApiRequest(request)
    const url = new URL(request.url)
    const q = url.searchParams.get("q")?.trim() ?? ""
    const type = url.searchParams.get("type") === "posts" ? "posts" : "users"
    const limit = parseLimit(request, 20, 50)

    if (!q) {
      return apiError(400, "missing_query", "Provide a search query via `?q=`.")
    }

    const results =
      type === "posts"
        ? await searchPosts(q, viewerId ?? "", new Set(), limit)
        : await searchUsers(q, viewerId ?? "", new Set(), limit)

    return apiSuccess({ type, results })
  })
}
