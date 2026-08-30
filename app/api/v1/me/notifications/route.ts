import { requireApiUser, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getNotifications } from "@/lib/notifications"

/**
 * GET /api/v1/me/notifications — the authenticated key's own
 * notifications, newest first. Requires a valid API key — like
 * bookmarks, notifications are always private to their owner.
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const notifications = await getNotifications(userId)
    return apiSuccess(notifications)
  })
}
