import type { NextRequest } from "next/server"
import { deletePost } from "@/app/actions/posts"
import { getPostById } from "@/lib/posts"
import { requireApiUser } from "@/lib/api/auth"
import { apiSuccess, ApiError, withApiErrorHandling } from "@/lib/api/respond"

/** GET /api/v1/posts/[id] — a single post plus the caller's interaction state (isLiked/isBookmarked/isReposted). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { id } = await params

    const post = await getPostById(id, userId)
    if (!post) {
      throw new ApiError(404, "not_found", "Post not found.")
    }
    return apiSuccess({ post })
  })
}

/** DELETE /api/v1/posts/[id] — delete a post owned by the caller. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { id } = await params

    const result = await deletePost(id, userId)
    if (!result.success) {
      throw new ApiError(404, "delete_post_failed", result.error ?? "Couldn't delete post.")
    }
    return apiSuccess({ success: true })
  })
}
