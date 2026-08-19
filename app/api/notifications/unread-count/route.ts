import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/notifications"

/**
 * Polled by the nav bell badge via SWR. A small dedicated endpoint —
 * rather than a server action — so it can be fetched from a client
 * component with a plain `fetch` and later swapped for a push-based
 * transport (SSE/WebSocket) without changing the badge component's
 * data-fetching contract.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const count = await getUnreadNotificationCount(session.user.id)
  return NextResponse.json({ count })
}
