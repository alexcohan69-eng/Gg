import type { NextRequest } from "next/server"
import { requireApiUser, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { likePostForUser, unlikePostForUser } from "@/app/actions/interactions"

/** Like `:id` as the authenticated API key's owner. Requires a valid API key. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const result = await likePostForUser(userId, id)
    return apiSuccess(result)
  })
}

/** Unlike `:id` as the authenticated API key's owner. Requires a valid API key. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const result = await unlikePostForUser(userId, id)
    return apiSuccess(result)
  })
}
