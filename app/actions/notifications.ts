"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type NotificationActionResult = {
  success: boolean
  error?: string
}

/**
 * Marks a single notification read. Scoped by userId so a viewer can
 * only ever mark their own notifications — there is no RLS on Aurora,
 * so this check is what protects the row.
 */
export async function markNotificationRead(
  notificationId: string,
): Promise<NotificationActionResult> {
  try {
    const userId = await getUserId()

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.id, notificationId), eq(notifications.userId, userId)),
      )

    revalidatePath("/notifications")
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't update notification." }
  }
}

export async function markAllNotificationsRead(): Promise<NotificationActionResult> {
  try {
    const userId = await getUserId()

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false)),
      )

    revalidatePath("/notifications")
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't update notifications." }
  }
}
