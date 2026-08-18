"use client"

import useSWR from "swr"

const UNREAD_COUNT_KEY = "/api/notifications/unread-count"

async function fetchUnreadCount(url: string): Promise<number> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load unread notification count")
  const data: { count: number } = await res.json()
  return data.count
}

/**
 * Keeps the sidebar bell badge in sync with the notifications page
 * without a full page reload — polls every 30s and revalidates
 * on-demand via `refresh()`. This is the seam future realtime support
 * (SSE/WebSocket push) would hook into: swap the fetcher/polling
 * interval for a subscription that calls `mutate` on this same key,
 * and every consumer of the hook updates for free.
 */
export function useUnreadNotificationCount(initialCount?: number) {
  const { data, mutate } = useSWR<number>(UNREAD_COUNT_KEY, fetchUnreadCount, {
    fallbackData: initialCount,
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  return {
    unreadCount: data ?? initialCount ?? 0,
    refresh: () => mutate(),
  }
}
