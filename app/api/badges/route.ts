import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { getUnreadNotificationCount } from "@/lib/notifications"
import { getUnreadMessageCount } from "@/lib/messages"

/**
 * Polled by `AppShell` to keep the notifications/messages nav badges
 * live across the whole app — not just after the viewer's own
 * actions (which already refresh via `revalidatePath`), but also when
 * someone else likes a post or sends a message while the viewer sits
 * on an unrelated page.
 */
export async function GET() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [unreadNotificationsCount, unreadMessagesCount] = await Promise.all([
      getUnreadNotificationCount(session.user.id),
      getUnreadMessageCount(session.user.id),
    ])

    return NextResponse.json({ unreadNotificationsCount, unreadMessagesCount })
  } catch (error) {
    console.error("[v0] Failed to load badge counts:", error)
    return NextResponse.json(
      { error: "Couldn't load badge counts." },
      { status: 500 },
    )
  }
}
