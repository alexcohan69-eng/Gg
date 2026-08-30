import { authenticateApiRequest, apiError, apiSuccess, requireApiUser, withApiErrorHandling } from "@/lib/api-auth"
import { getPostById, getPostReplies } from "@/lib/posts"
import { deletePostForUser, type PostActionResult } from "@/app/actions/posts"

/**
 * GET /api/v1/posts/:id — a single post plus its direct replies. No
 * API key required; an optional one adds the caller's own
 * like/bookmark/repost state.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await params
    const { userId: viewerId } = await authenticateApiRequest(request)

    const post = await getPostById(id, viewerId ?? "")
    if (!post) {
      return apiError(404, "post_not_found", `No post found for id "${id}".`)
    }
    const replies = await getPostReplies(id, viewerId ?? "")

    return apiSuccess({ ...post, replies })
  })
}

/**
 * DELETE /api/v1/posts/:id — deletes the post if (and only if) it
 * belongs to the authenticated key's own user. Reuses
 * `deletePostForUser` from app/actions/posts.ts, so ownership
 * enforcement is identical to the web app's delete button.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { id } = await params
    const userId = await requireApiUser(request)

    const result: PostActionResult = await deletePostForUser(userId, id)
    if (!result.success) {
      return apiError(404, "post_not_found", result.error ?? "Post not found.")
    }
    return apiSuccess({ success: true })
  })
}
