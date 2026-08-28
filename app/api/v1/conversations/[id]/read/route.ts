import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { getConversationForViewer, markConversationRead } from "@/lib/messages"

/** POST /api/v1/conversations/[id]/read — marks the other participant's messages as read. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const conversation = await getConversationForViewer(id, auth.userId)
  if (!conversation) return apiError(404, "Conversation not found.")

  await markConversationRead(id, auth.userId)
  return apiSuccess({ read: true })
}
