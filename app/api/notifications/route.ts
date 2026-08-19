import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import { getNotifications } from "@/lib/notifications"

/**
 * Polled by the notifications page's client wrapper so a new like,
 * reply, repost, or follow shows up in the list itself — not just as
 * a nav badge count — while the viewer is already looking at the page.
 */
export async function GET() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const notifications = await getNotifications(session.user.id)
    return NextResponse.json({ notifications })
  } catch (error) {
    logActionError("getNotifications", error, { userId: session.user.id })
    return NextResponse.json(
      { error: "Couldn't load notifications." },
      { status: 500 },
    )
  }
}
