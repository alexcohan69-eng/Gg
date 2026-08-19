"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { mutate } from "swr"
import { toast } from "sonner"
import { CheckCheckIcon } from "lucide-react"
import { markAllNotificationsRead } from "@/app/actions/notifications"
import { Button } from "@/components/ui/button"

export function MarkAllReadButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await markAllNotificationsRead()
      if (!result.success) {
        toast.error(result.error ?? "Couldn't mark notifications as read.")
        return
      }
      // Nudge the nav badge and the live notifications list down
      // immediately instead of waiting for their next poll tick;
      // router.refresh() still handles this button's own visibility
      // (it's computed server-side from `hasUnread`).
      mutate("/api/badges")
      mutate("/api/notifications")
      router.refresh()
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
