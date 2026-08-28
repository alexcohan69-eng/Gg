import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { getConversations, getOrCreateConversation } from "@/lib/messages"
import { getProfileByIdentifier } from "@/lib/follows"
import { isBlockedEitherWay } from "@/lib/blocks"

/** GET /api/v1/conversations — the authenticated user's conversation inbox. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const conversations = await getConversations(auth.userId)
  return apiSuccess({ conversations })
}

type StartConversationBody = { username: string }

/** POST /api/v1/conversations — start (or resume) a 1:1 conversation. Body: `{ username }`. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<StartConversationBody>(request)
  if ("error" in body) return body.error
  const { username } = body.data
  if (!username) return apiError(400, "username is required.")

  const target = await getProfileByIdentifier(username)
  if (!target) return apiError(404, "User not found.")
  if (target.id === auth.userId) return apiError(400, "You can't start a conversation with yourself.")

  if (await isBlockedEitherWay(auth.userId, target.id)) {
    return apiError(403, "You can't message this account.")
  }

  const conversationId = await getOrCreateConversation(auth.userId, target.id)
  return apiSuccess({ conversationId }, 201)
}
