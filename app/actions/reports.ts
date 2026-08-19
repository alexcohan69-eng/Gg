"use server"

import { headers } from "next/headers"
import { eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { posts, reports } from "@/lib/db/schema"
import { logActionError } from "@/lib/log-action-error"
import { REPORT_REASON_VALUES, type ReportReason } from "@/lib/moderation"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type ReportActionResult = {
  success: boolean
  error?: string
}

function isValidReason(reason: string): reason is ReportReason {
  return (REPORT_REASON_VALUES as readonly string[]).includes(reason)
}

/**
 * Reports are insert-only and self-scoped by `reporterId` — there's no
 * review/admin surface yet (deferred to a later phase), so this just
 * records the signal. The unique (reporterId, targetType, targetId)
 * index makes a duplicate report of the same target a no-op rather
 * than piling up rows from repeat taps.
 */
export async function reportPost(
  postId: string,
  reason: string,
): Promise<ReportActionResult> {
  try {
    const userId = await getUserId()
    if (!isValidReason(reason)) {
      return { success: false, error: "Invalid report reason." }
    }

    const [post] = await db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1)
    if (!post) return { success: false, error: "Post not found." }

    await db
      .insert(reports)
      .values({
        id: crypto.randomUUID(),
        reporterId: userId,
        targetType: "post",
        targetId: postId,
        reason,
      })
      .onConflictDoNothing()

    return { success: true }
  } catch (error) {
    logActionError("reportPost", error, { postId })
    return { success: false, error: "Couldn't submit report." }
  }
}

export async function reportUser(
  targetUserId: string,
  reason: string,
): Promise<ReportActionResult> {
  try {
    const userId = await getUserId()
    if (!isValidReason(reason)) {
      return { success: false, error: "Invalid report reason." }
    }
    if (userId === targetUserId) {
      return { success: false, error: "You can't report yourself." }
    }

    await db
      .insert(reports)
      .values({
        id: crypto.randomUUID(),
        reporterId: userId,
        targetType: "user",
        targetId: targetUserId,
        reason,
      })
      .onConflictDoNothing()

    return { success: true }
  } catch (error) {
    logActionError("reportUser", error, { targetUserId })
    return { success: false, error: "Couldn't submit report." }
  }
}
