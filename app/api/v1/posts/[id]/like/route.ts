import type { NextRequest } from "next/server"
import { likePost, unlikePost } from "@/app/actions/interactions"
import { requireApiUser } from "@/lib/api/auth"
import { apiSuccess, ApiError, withApiErrorHandling } from "@/lib/api/respond"

/** POST /api/v1/posts/[id]/like — like a post. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { id } = await params

    const result = await likePost(id, userId)
    if (!result.success) {
      throw new ApiError(400, "like_failed", result.error ?? "Couldn't like post.")
    }
    return apiSuccess({ success: true })
  })
}

/** DELETE /api/v1/posts/[id]/like — unlike a post. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { id } = await params

    const result = await unlikePost(id, userId)
    if (!result.success) {
      throw new ApiError(400, "unlike_failed", result.error ?? "Couldn't unlike post.")
    }
    return apiSuccess({ success: true })
  })
}
