import type { FeedNotification } from "@/lib/notifications"

/** The wire shape of a notification once it's round-tripped through JSON. */
export type FeedNotificationDTO = Omit<FeedNotification, "createdAt"> & {
  createdAt: string
}

/**
 * Shared SWR key/fetcher/interval for `/api/notifications`, used by both
 * `NotificationListLive` and `MarkAllReadButton`. Because both hooks
 * subscribe to the exact same key with the exact same fetcher, SWR
 * treats them as one shared cache entry (and dedupes the underlying
 * network request) — so the button's "is there anything unread"
 * check reacts to the same 15s poll that keeps the list live, instead
 * of only knowing about notifications present at page load.
 */
export const NOTIFICATIONS_KEY = "/api/notifications"
export const NOTIFICATIONS_POLL_INTERVAL_MS = 15000

export async function notificationsFetcher(url: string): Promise<FeedNotification[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to load notifications")
  const data: { notifications: FeedNotificationDTO[] } = await response.json()
  return data.notifications.map((notification) => ({
    ...notification,
    createdAt: new Date(notification.createdAt),
  }))
}
