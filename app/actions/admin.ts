"use server"

import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { posts, reports } from "@/lib/db/schema"
import { requireAdminUserId } from "@/lib/admin"
import { logActionError } from "@/lib/log-action-error"
import { mediaUrlToPathname } from "@/lib/media"

export type AdminActionResult = {
  success: boolean
  error?: string
}

function revalidateAdminPaths() {
  revalidatePath("/admin")
  revalidatePath("/home")
  revalidatePath("/profile")
  revalidatePath("/explore")
}

/** Marks a report reviewed with no other action taken — e.g. a false positive or a duplicate. */
export async function dismissReport(reportId: string): Promise<AdminActionResult> {
  try {
    const adminId = await requireAdminUserId()

    await db
      .update(reports)
      .set({ status: "dismissed", reviewedBy: adminId, reviewedAt: new Date() })
      .where(eq(reports.id, reportId))

    revalidateAdminPaths()
    return { success: true }
  } catch (error) {
    logActionError("dismissReport", error, { reportId })
    return { success: false, error: "Couldn't dismiss report." }
  }
}

/** Marks a report reviewed and actioned — used when the moderator handled the issue some other way (e.g. contacted the user). */
export async function resolveReport(reportId: string): Promise<AdminActionResult> {
  try {
    const adminId = await requireAdminUserId()

    await db
      .update(reports)
      .set({ status: "resolved", reviewedBy: adminId, reviewedAt: new Date() })
      .where(eq(reports.id, reportId))

    revalidateAdminPaths()
    return { success: true }
  } catch (error) {
    logActionError("resolveReport", error, { reportId })
    return { success: false, error: "Couldn't resolve report." }
  }
}

/** Moves a resolved/dismissed report back to the open queue. */
export async function reopenReport(reportId: string): Promise<AdminActionResult> {
  try {
    await requireAdminUserId()

    await db
      .update(reports)
      .set({ status: "open", reviewedBy: null, reviewedAt: null })
      .where(eq(reports.id, reportId))

    revalidateAdminPaths()
    return { success: true }
  } catch (error) {
    logActionError("reopenReport", error, { reportId })
    return { success: false, error: "Couldn't reopen report." }
  }
}

/**
 * Admin-only post removal for a reported post. Unlike the regular
 * `deletePost` action, this is NOT scoped by `userId` — an admin must
 * be able to remove any user's post — so `requireAdminUserId` is the
 * only thing standing between this and deleting an arbitrary post.
 * Also resolves the report that prompted the removal in the same
 * transaction so the queue and the deletion can't drift apart.
 */
export async function adminDeletePost(
  postId: string,
  reportId: string,
): Promise<AdminActionResult> {
  try {
    const adminId = await requireAdminUserId()

    const deleted = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(posts)
        .where(eq(posts.id, postId))
        .returning({ id: posts.id, replyToId: posts.replyToId, media: posts.media })

      if (row?.replyToId) {
        await tx
          .update(posts)
          .set({ replyCount: sql`greatest(${posts.replyCount} - 1, 0)` })
          .where(eq(posts.id, row.replyToId))
      }

      await tx
        .update(reports)
        .set({ status: "resolved", reviewedBy: adminId, reviewedAt: new Date() })
        .where(eq(reports.id, reportId))

      return row
    })

    if (!deleted) {
      return { success: false, error: "Post not found." }
    }

    const pathnames = (deleted.media ?? [])
      .map((item) => mediaUrlToPathname(item.url))
      .filter((p): p is string => p !== null)

    if (pathnames.length) {
      try {
        await del(pathnames)
      } catch (error) {
        logActionError("adminDeletePostMedia", error, { postId })
      }
    }

    revalidateAdminPaths()
    revalidatePath(`/post/${postId}`)
    if (deleted.replyToId) revalidatePath(`/post/${deleted.replyToId}`)

    return { success: true }
  } catch (error) {
    logActionError("adminDeletePost", error, { postId, reportId })
    return { success: false, error: "Couldn't delete post." }
  }
}
