import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getSessionWithRetry } from "@/lib/auth"
import { logActionError } from "@/lib/log-action-error"
import { getConversations } from "@/lib/messages"

/**
 * Polled by the inbox page's client wrapper so new conversations,
 * incoming messages, and unread counts show up without the viewer
 * having to navigate away and back.
 */
export async function GET() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const conversations = await getConversations(session.user.id)
    return NextResponse.json({ conversations })
  } catch (error) {
    logActionError("getConversations", error, { userId: session.user.id })
    return NextResponse.json(
      { error: "Couldn't load conversations." },
      { status: 500 },
    )
  }
}
