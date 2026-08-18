import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/notifications"

/**
 * Polled by `useUnreadNotificationCount` (see hooks/use-notifications.ts)
 * to keep the sidebar bell badge in sync with the notifications page.
 * Deliberately a plain polled GET rather than a push channel — swapping
 * this hook's fetcher for a WebSocket/SSE subscription later doesn't
 * require touching any of the UI that consumes it.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const count = await getUnreadNotificationCount(session.user.id)
  return NextResponse.json({ count })
}
