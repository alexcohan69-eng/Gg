import { desc, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { posts, reports, user } from "@/lib/db/schema"
import type { ReportReason, ReportTargetType } from "@/lib/moderation"

export type ReportStatus = "open" | "resolved" | "dismissed"

export type ReportTarget =
  | {
      type: "post"
      exists: true
      content: string
      authorId: string
      authorName: string
      authorUsername: string | null
    }
  | {
      type: "user"
      exists: true
      id: string
      name: string
      username: string | null
    }
  | { type: ReportTargetType; exists: false }

export type ReportRow = {
  id: string
  reporterId: string
  reporterName: string
  reporterUsername: string | null
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  status: ReportStatus
  createdAt: Date
  reviewedAt: Date | null
  reviewedBy: string | null
  target: ReportTarget
}

/**
 * Reports for the admin review queue, most recent first. Reports
 * reference their target by a plain `(targetType, targetId)` pair
 * rather than a foreign key (a single report row can point at either
 * a post or a user), so the target's current content/author is
 * fetched in two batched follow-up queries instead of a join —
 * this also lets a report whose target was since deleted render as
 * "deleted" instead of silently disappearing from the queue.
 */
export async function getReports(status: ReportStatus): Promise<ReportRow[]> {
  const rows = await db
    .select({
      id: reports.id,
      reporterId: reports.reporterId,
      reporterName: user.name,
      reporterUsername: user.username,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      reviewedAt: reports.reviewedAt,
      reviewedBy: reports.reviewedBy,
    })
    .from(reports)
    .innerJoin(user, eq(reports.reporterId, user.id))
    .where(eq(reports.status, status))
    .orderBy(desc(reports.createdAt))

  const postTargetIds = [
    ...new Set(rows.filter((r) => r.targetType === "post").map((r) => r.targetId)),
  ]
  const userTargetIds = [
    ...new Set(rows.filter((r) => r.targetType === "user").map((r) => r.targetId)),
  ]

  const [postTargets, userTargets] = await Promise.all([
    postTargetIds.length
      ? db
          .select({ id: posts.id, content: posts.content, authorId: posts.userId })
          .from(posts)
          .where(inArray(posts.id, postTargetIds))
      : Promise.resolve([]),
    userTargetIds.length
      ? db
          .select({ id: user.id, name: user.name, username: user.username })
          .from(user)
          .where(inArray(user.id, userTargetIds))
      : Promise.resolve([]),
  ])

  const authorIds = [...new Set(postTargets.map((p) => p.authorId))]
  const authors = authorIds.length
    ? await db
        .select({ id: user.id, name: user.name, username: user.username })
        .from(user)
        .where(inArray(user.id, authorIds))
    : []

  const authorMap = new Map(authors.map((a) => [a.id, a]))
  const postMap = new Map(postTargets.map((p) => [p.id, p]))
  const userMap = new Map(userTargets.map((u) => [u.id, u]))

  return rows.map((row): ReportRow => {
    const reason = row.reason as ReportReason
    const status = row.status as ReportStatus
    const targetType = row.targetType as ReportTargetType

    if (targetType === "post") {
      const post = postMap.get(row.targetId)
      if (!post) {
        return { ...row, reason, status, targetType, target: { type: "post", exists: false } }
      }
      const author = authorMap.get(post.authorId)
      return {
        ...row,
        reason,
        status,
        targetType,
        target: {
          type: "post",
          exists: true,
          content: post.content,
          authorId: post.authorId,
          authorName: author?.name ?? "Unknown",
          authorUsername: author?.username ?? null,
        },
      }
    }

    const targetUser = userMap.get(row.targetId)
    if (!targetUser) {
      return { ...row, reason, status, targetType, target: { type: "user", exists: false } }
    }
    return {
      ...row,
      reason,
      status,
      targetType,
      target: {
        type: "user",
        exists: true,
        id: targetUser.id,
        name: targetUser.name,
        username: targetUser.username,
      },
    }
  })
}

/** Open report count — used for the admin nav badge. */
export async function getOpenReportCount(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reports)
    .where(eq(reports.status, "open"))

  return rows[0]?.count ?? 0
}
