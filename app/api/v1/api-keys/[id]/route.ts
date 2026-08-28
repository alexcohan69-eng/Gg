import type { NextRequest } from "next/server"
import { requireApiUser } from "@/lib/api/auth"
import { ApiError, apiSuccess, withApiErrorHandling } from "@/lib/api/respond"
import { revokeApiKey } from "@/lib/api-keys"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { id } = await params
    const revoked = await revokeApiKey(userId, id)
    if (!revoked) {
      throw new ApiError(404, "not_found", "No active API key with that id belongs to you.")
    }
    return apiSuccess({ id, revoked: true })
  })
}
