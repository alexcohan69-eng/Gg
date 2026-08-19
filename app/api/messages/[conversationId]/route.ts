import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getConversationForViewer,
  getMessages,
  markConversationRead,
} from "@/lib/messages"

/**
 * Polled by the thread page's client wrapper to pick up messages the
 * other participant sends while the viewer is looking at the thread,
 * without a manual refresh. Same ownership check as the page itself
 * (`getConversationForViewer`) — a conversation id in the URL isn't
 * enough on its own, since there's no RLS on Aurora.
 *
 * Being polled here is equivalent to actively viewing the thread, so
 * this also marks the other participant's messages read on every
 * call, mirroring the page's initial-load behavior.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { conversationId } = await params

  try {
    const conversation = await getConversationForViewer(
      conversationId,
      session.user.id,
    )
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      )
    }

    await markConversationRead(conversationId, session.user.id)
    const messages = await getMessages(conversationId)

    return NextResponse.json({ messages })
  } catch (error) {
    console.error("[v0] Failed to load thread messages:", error)
    return NextResponse.json(
      { error: "Couldn't load messages." },
      { status: 500 },
    )
  }
}
