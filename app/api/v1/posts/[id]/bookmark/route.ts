import type { NextRequest } from "next/server"
import { bookmarkPost, removeBookmark } from "@/app/actions/interactions"
import { requireApiUser } from "@/lib/api/auth"
import { apiSuccess, ApiError, withApiErrorHandling } from "@/lib/api/respond"

/** POST /api/v1/posts/[id]/bookmark — bookmark a post. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    await requireApiUser(req)
    const { id } = await params

    const result = await bookmarkPost(id)
    if (!result.success) {
      throw new ApiError(400, "bookmark_failed", result.error ?? "Couldn't bookmark post.")
    }
    return apiSuccess({ success: true })
  })
}

/** DELETE /api/v1/posts/[id]/bookmark — remove a bookmark. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    await requireApiUser(req)
    const { id } = await params

    const result = await removeBookmark(id)
    if (!result.success) {
      throw new ApiError(400, "remove_bookmark_failed", result.error ?? "Couldn't remove bookmark.")
    }
    return apiSuccess({ success: true })
  })
}
