import type { NextRequest } from "next/server"
import { authenticateApiRequest, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { repostPostForUser, undoRepostForUser } from "@/app/actions/interactions"

/** Repost `:id` as the authenticated API key's owner. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await authenticateApiRequest(request)
    const { id } = await params
    const result = await repostPostForUser(userId, id)
    return apiSuccess(result)
  })
}

/** Undo a repost of `:id` as the authenticated API key's owner. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await authenticateApiRequest(request)
    const { id } = await params
    const result = await undoRepostForUser(userId, id)
    return apiSuccess(result)
  })
}
