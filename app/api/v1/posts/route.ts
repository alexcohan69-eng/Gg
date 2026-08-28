import type { NextRequest } from "next/server"
import { createPost } from "@/app/actions/posts"
import { getFeedPosts } from "@/lib/posts"
import { requireApiUser } from "@/lib/api/auth"
import { apiSuccess, ApiError, withApiErrorHandling } from "@/lib/api/respond"
import { parsePagination } from "@/lib/api/pagination"

/**
 * GET /api/v1/posts — the authenticated caller's home feed
 * (chronological, top-level posts only), paginated with the shared
 * `?limit=&cursor=` convention. Reuses `getFeedPosts` from `lib/posts`
 * (the same query the web "For you" tab uses) so results always match
 * what's rendered in the app.
 */
export async function GET(req: NextRequest) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const { limit } = parsePagination(req.nextUrl.searchParams)

    const posts = await getFeedPosts(userId, new Set(), limit)
    return apiSuccess({ posts })
  })
}

/**
 * POST /api/v1/posts — create a top-level post or a reply (pass
 * `replyToId` in the JSON body). Delegates straight to the existing
 * `createPost` server action (rebuilt as a FormData call) so
 * validation, sanitization, and notification logic stay in one place.
 */
export async function POST(req: NextRequest) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      throw new ApiError(400, "invalid_body", "Request body must be JSON.")
    }

    const formData = new FormData()
    formData.set("content", typeof body.content === "string" ? body.content : "")
    if (typeof body.replyToId === "string") formData.set("replyToId", body.replyToId)
    if (typeof body.attachment === "string") formData.set("attachment", body.attachment)
    if (Array.isArray(body.media)) formData.set("media", JSON.stringify(body.media))

    const result = await createPost(formData, userId)
    if (!result.success) {
      throw new ApiError(400, "create_post_failed", result.error ?? "Couldn't create post.")
    }

    return apiSuccess({ success: true }, 201)
  })
}
