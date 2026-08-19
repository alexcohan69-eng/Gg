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
import {
  NOTIFICATIONS_KEY,
  NOTIFICATIONS_POLL_INTERVAL_MS,
  notificationsFetcher,
} from "@/lib/swr/notifications"

/**
 * Wraps the notifications list with polling so a like, reply, repost,
 * or new follower shows up while the viewer is already looking at this
 * page, not just after a manual refresh — matching the nav badge
 * (`AppShell`), which already polls the same underlying data every 15s.
 * `initialNotifications` seeds SWR's `fallbackData` so first paint is
 * server-rendered with no loading flicker, and the list still renders
 * (just without live updates) with JavaScript disabled.
 */
export function NotificationListLive({
  initialNotifications,
}: {
  initialNotifications: FeedNotification[]
}) {
  const { data } = useSWR<FeedNotification[]>(
    NOTIFICATIONS_KEY,
    notificationsFetcher,
    {
      fallbackData: initialNotifications,
      refreshInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    },
  )

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
