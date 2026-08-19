"use client"

import useSWR from "swr"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

/**
 * Small unread-count dot rendered next to the Notifications nav item.
 * Polls a dedicated endpoint via SWR rather than a server action so
 * the transport can be swapped for SSE/WebSocket push later without
 * touching call sites — this is the "scalable foundation" for
 * realtime, not realtime itself.
 */
export function NotificationBellBadge({ className }: { className?: string }) {
  const { data } = useSWR<{ count: number }>(
    "/api/notifications/unread-count",
    fetcher,
    { refreshInterval: 20_000, revalidateOnFocus: true },
  )

  const count = data?.count ?? 0
  if (count === 0) return null

  return (
    <span
      className={cn(
        "absolute -right-0.5 -top-0.5 flex size-2.5 rounded-full bg-primary ring-2 ring-background",
        className,
      )}
      aria-hidden="true"
    />
  )
}
