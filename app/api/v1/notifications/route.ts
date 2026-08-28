import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiSuccess, parsePagination } from "@/lib/api/response"
import { getNotifications } from "@/lib/notifications"

/** GET /api/v1/notifications */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { limit } = parsePagination(request, 50)
  const notifications = await getNotifications(auth.userId, limit)
  return apiSuccess({ notifications })
}
