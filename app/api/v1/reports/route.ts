import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { posts, reports } from "@/lib/db/schema"
import { REPORT_REASON_VALUES, type ReportReason, type ReportTargetType } from "@/lib/moderation"

function isValidReason(reason: string): reason is ReportReason {
  return (REPORT_REASON_VALUES as readonly string[]).includes(reason)
}

type ReportBody = { targetType: ReportTargetType; targetId: string; reason: string }

/** POST /api/v1/reports — report a post or a user. Body: `{ targetType, targetId, reason }`. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<ReportBody>(request)
  if ("error" in body) return body.error
  const { targetType, targetId, reason } = body.data

  if (targetType !== "post" && targetType !== "user") {
    return apiError(400, "targetType must be 'post' or 'user'.")
  }
  if (!targetId) return apiError(400, "targetId is required.")
  if (!reason || !isValidReason(reason)) return apiError(400, "Invalid report reason.")

  if (targetType === "post") {
    const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, targetId)).limit(1)
    if (!post) return apiError(404, "Post not found.")
  } else if (targetId === auth.userId) {
    return apiError(400, "You can't report yourself.")
  }

  await db
    .insert(reports)
    .values({ id: crypto.randomUUID(), reporterId: auth.userId, targetType, targetId, reason })
    .onConflictDoNothing()

  return apiSuccess({ reported: true }, 201)
}
