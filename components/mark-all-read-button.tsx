"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
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
