"use client"

import useSWR from "swr"
import { BellIcon } from "lucide-react"
import { NotificationItem } from "@/components/notification-item"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import type { FeedNotification } from "@/lib/notifications"

/** The wire shape of a notification once it's round-tripped through JSON. */
type FeedNotificationDTO = Omit<FeedNotification, "createdAt"> & {
  createdAt: string
}

export const NOTIFICATIONS_KEY = "/api/notifications"

async function fetcher(url: string): Promise<FeedNotification[]> {
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to load notifications")
  const data: { notifications: FeedNotificationDTO[] } = await response.json()
  return data.notifications.map((notification) => ({
    ...notification,
    createdAt: new Date(notification.createdAt),
  }))
}

const POLL_INTERVAL_MS = 10000

/**
 * Shared SWR hook for the notifications list, so this component and
 * `NotificationHeaderActions` (the "Mark all read" button, rendered
 * in the page header) read the same cache entry and stay in sync
 * without double-fetching — SWR dedupes concurrent requests for an
 * identical key.
 */
export function useNotificationsList(initialNotifications: FeedNotification[]) {
  return useSWR<FeedNotification[]>(NOTIFICATIONS_KEY, fetcher, {
    fallbackData: initialNotifications,
    refreshInterval: POLL_INTERVAL_MS,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  })
}

/**
 * Wraps the notification rows with polling so a new like, reply,
 * repost, or follow appears on its own — those are always caused by
 * someone else, so without this the viewer would only see them after
 * a manual reload even though the nav badge already updated live.
 * `initialNotifications` (from the server-rendered page) seeds SWR's
 * `fallbackData`, so there's no loading flicker on first paint and
 * the list still renders correctly with JavaScript disabled.
 */
export function NotificationList({
  initialNotifications,
}: {
  initialNotifications: FeedNotification[]
}) {
  const { data } = useNotificationsList(initialNotifications)
  const notifications = data ?? initialNotifications

  if (notifications.length === 0) {
    return (
      <div className="p-4">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BellIcon />
            </EmptyMedia>
            <EmptyTitle>No notifications yet</EmptyTitle>
            <EmptyDescription>
              Likes, replies, reposts, and new followers will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div>
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  )
}
