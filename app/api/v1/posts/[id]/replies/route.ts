import type { NextRequest } from "next/server"
import { getPostReplies } from "@/lib/posts"
import { requireApiUser } from "@/lib/api/auth"
import { apiSuccess, withApiErrorHandling } from "@/lib/api/respond"
import { parsePagination } from "@/lib/api/pagination"

/** GET /api/v1/posts/[id]/replies — direct replies to a post, oldest first. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { id } = await params
    const { limit } = parsePagination(req.nextUrl.searchParams)

    const replies = await getPostReplies(id, userId, new Set(), limit)
    return apiSuccess({ replies })
  })
}
