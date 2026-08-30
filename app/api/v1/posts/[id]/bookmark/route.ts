import type { NextRequest } from "next/server"
import { authenticateApiRequest, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { bookmarkPostForUser, removeBookmarkForUser } from "@/app/actions/interactions"

/** Bookmark `:id` as the authenticated API key's owner. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await authenticateApiRequest(request)
    const { id } = await params
    const result = await bookmarkPostForUser(userId, id)
    return apiSuccess(result)
  })
}

/** Remove a bookmark of `:id` as the authenticated API key's owner. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await authenticateApiRequest(request)
    const { id } = await params
    const result = await removeBookmarkForUser(userId, id)
    return apiSuccess(result)
  })
}
