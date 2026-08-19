"use client"

import { useNotificationsList } from "@/components/notification-list"
import { MarkAllReadButton } from "@/components/mark-all-read-button"
import type { FeedNotification } from "@/lib/notifications"

/**
 * Renders "Mark all read" in the page header, reading the same SWR
 * cache entry as `NotificationList` so the button appears/disappears
 * live as new notifications arrive or get read elsewhere — not just
 * based on the server-rendered snapshot at page load.
 */
export function NotificationHeaderActions({
  initialNotifications,
}: {
  initialNotifications: FeedNotification[]
}) {
  const { data } = useNotificationsList(initialNotifications)
  const notifications = data ?? initialNotifications
  const hasUnread = notifications.some((notification) => !notification.isRead)

  if (!hasUnread) return null
  return <MarkAllReadButton />
}
