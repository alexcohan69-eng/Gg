"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications"

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type NotificationActionResult = {
  success: boolean
  error?: string
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<NotificationActionResult> {
  try {
    const userId = await getUserId()
    // Scoped by userId inside markNotificationRead — there is no RLS on
    // Aurora, so this is what stops one user marking another's rows read.
    await markNotificationRead(notificationId, userId)
    revalidatePath("/notifications")
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't mark notification as read." }
  }
}

export async function markAllNotificationsAsRead(): Promise<NotificationActionResult> {
  try {
    const userId = await getUserId()
    await markAllNotificationsRead(userId)
    revalidatePath("/notifications")
    return { success: true }
  } catch {
    return { success: false, error: "Couldn't mark notifications as read." }
  }
}
