"use client"

import { useTransition } from "react"
import { mutate } from "swr"
import { toast } from "sonner"
import { CheckCheckIcon } from "lucide-react"
import { markAllNotificationsRead } from "@/app/actions/notifications"
import { NOTIFICATIONS_KEY } from "@/components/notification-list"
import { Button } from "@/components/ui/button"

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await markAllNotificationsRead()
      if (!result.success) {
        toast.error(result.error ?? "Couldn't mark notifications as read.")
        return
      }
      // Nudge the nav badge and the notification list itself down
      // immediately instead of waiting for their next poll tick —
      // both read the server for the fresh state, so this is safe
      // even though the button's own visibility comes from the same
      // list data via `NotificationHeaderActions`.
      mutate("/api/badges")
      mutate(NOTIFICATIONS_KEY)
    })
  }

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
