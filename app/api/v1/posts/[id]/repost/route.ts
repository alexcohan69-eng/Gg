import type { NextRequest } from "next/server"
import { repostPost, undoRepost } from "@/app/actions/interactions"
import { requireApiUser } from "@/lib/api/auth"
import { apiSuccess, ApiError, withApiErrorHandling } from "@/lib/api/respond"

/** POST /api/v1/posts/[id]/repost — repost a post. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    await requireApiUser(req)
    const { id } = await params

    const result = await repostPost(id)
    if (!result.success) {
      throw new ApiError(400, "repost_failed", result.error ?? "Couldn't repost.")
    }
    return apiSuccess({ success: true })
  })
}

/** DELETE /api/v1/posts/[id]/repost — undo a repost. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    await requireApiUser(req)
    const { id } = await params

    const result = await undoRepost(id)
    if (!result.success) {
      throw new ApiError(400, "undo_repost_failed", result.error ?? "Couldn't undo repost.")
    }
    return apiSuccess({ success: true })
  })
}
