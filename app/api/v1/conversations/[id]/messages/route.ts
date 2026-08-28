import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { conversations, messages } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getConversationForViewer, getMessages } from "@/lib/messages"
import { isBlockedEitherWay } from "@/lib/blocks"

const MAX_MESSAGE_LENGTH = 2000

/** GET /api/v1/conversations/[id]/messages */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const conversation = await getConversationForViewer(id, auth.userId)
  if (!conversation) return apiError(404, "Conversation not found.")

  const results = await getMessages(id)
  return apiSuccess({ messages: results })
}

type SendMessageBody = { content: string }

/** POST /api/v1/conversations/[id]/messages — send a message. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const body = await parseJsonBody<SendMessageBody>(request)
  if ("error" in body) return body.error

  const trimmed = String(body.data.content ?? "").trim()
  if (!trimmed) return apiError(400, "content can't be empty.")
  if (trimmed.length > MAX_MESSAGE_LENGTH) return apiError(400, "content is too long.")

  const conversation = await getConversationForViewer(id, auth.userId)
  if (!conversation) return apiError(404, "Conversation not found.")

  if (await isBlockedEitherWay(auth.userId, conversation.otherUser.id)) {
    return apiError(403, "You can't message this account.")
  }

  const messageId = crypto.randomUUID()
  await db.insert(messages).values({
    id: messageId,
    conversationId: id,
    senderId: auth.userId,
    content: trimmed,
  })
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, id))

  return apiSuccess({ id: messageId }, 201)
}
