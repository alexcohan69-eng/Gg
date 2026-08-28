import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiSuccess, parsePagination } from "@/lib/api/response"
import { getPostReplies } from "@/lib/posts"
import { getBlockedUserIds } from "@/lib/blocks"

/** GET /api/v1/posts/[id]/replies — direct replies to a post, oldest first. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const blocked = await getBlockedUserIds(auth.userId)
  const { limit } = parsePagination(request)
  const replies = await getPostReplies(id, auth.userId, blocked, limit)
  return apiSuccess({ replies })
}
