"use client"

import { useTransition } from "react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { CheckCheckIcon } from "lucide-react"
import { markAllNotificationsRead } from "@/app/actions/notifications"
import { Button } from "@/components/ui/button"
import {
  NOTIFICATIONS_KEY,
  NOTIFICATIONS_POLL_INTERVAL_MS,
  notificationsFetcher,
} from "@/lib/swr/notifications"

export function MarkAllReadButton({
  initialHasUnread,
}: {
  initialHasUnread: boolean
}) {
  const [isPending, startTransition] = useTransition()

  // Subscribes to the same key/fetcher as `NotificationListLive`, so
  // this button's visibility reacts to notifications that arrive via
  // polling too — not just the ones present when the page first
  // loaded. Falls back to the server-computed value until the shared
  // cache resolves (near-instant, since the list component usually
  // seeds it first via `fallbackData`).
  const { data } = useSWR(NOTIFICATIONS_KEY, notificationsFetcher, {
    refreshInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
  })
  const hasUnread = data
    ? data.some((notification) => !notification.isRead)
    : initialHasUnread

  function handleClick() {
    startTransition(async () => {
      const result = await markAllNotificationsRead()
      if (!result.success) {
        toast.error(result.error ?? "Couldn't mark notifications as read.")
        return
      }
      // Revalidate the shared notifications cache and the nav badge
      // immediately instead of waiting for their next poll tick — this
      // button's own visibility now updates from the same revalidation.
      mutate(NOTIFICATIONS_KEY)
      mutate("/api/badges")
    })
  }

  if (!hasUnread) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 rounded-full text-sm"
      onClick={handleClick}
      disabled={isPending}
    >
      <CheckCheckIcon className="size-4" aria-hidden="true" />
      Mark all read
    </Button>
  )
}
