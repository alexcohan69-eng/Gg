"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/app/actions/notifications"
import { NotificationItem } from "@/components/notification-item"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { useUnreadNotificationCount } from "@/hooks/use-notifications"
import type { NotificationItem as NotificationItemData } from "@/lib/notifications"

export function NotificationList({
  initialNotifications,
}: {
  initialNotifications: NotificationItemData[]
}) {
  const [notifications, setNotifications] = useState(initialNotifications)
  const [isPending, startTransition] = useTransition()
  const { refresh: refreshUnreadCount } = useUnreadNotificationCount()

  const unreadCount = notifications.filter((n) => !n.isRead).length

  function markLocalRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    )
  }

  function handleOpen(id: string) {
    const target = notifications.find((n) => n.id === id)
    if (!target || target.isRead) return
    markLocalRead(id)
    startTransition(async () => {
      const result = await markNotificationAsRead(id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't mark as read.")
      }
      refreshUnreadCount()
    })
  }

  function handleMarkOne(id: string) {
    markLocalRead(id)
    startTransition(async () => {
      const result = await markNotificationAsRead(id)
      if (!result.success) {
        toast.error(result.error ?? "Couldn't mark as read.")
      }
      refreshUnreadCount()
    })
  }

  function handleMarkAll() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    startTransition(async () => {
      const result = await markAllNotificationsAsRead()
      if (!result.success) {
        toast.error(result.error ?? "Couldn't mark all as read.")
      }
      refreshUnreadCount()
    })
  }

  return (
    <div className="flex flex-col">
      {notifications.length > 0 ? (
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleMarkAll}
            disabled={isPending || unreadCount === 0}
          >
            <CheckCheckIcon />
            Mark all as read
          </Button>
        </div>
      ) : null}

      {notifications.length === 0 ? (
        <div className="p-4">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellIcon />
              </EmptyMedia>
              <EmptyTitle>No notifications yet</EmptyTitle>
              <EmptyDescription>
                Likes, replies, reposts, and new followers will show up
                here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onOpen={handleOpen}
              onMarkRead={handleMarkOne}
            />
          ))}
        </div>
      )}
    </div>
  )
}
