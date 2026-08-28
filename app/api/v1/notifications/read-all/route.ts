import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"

/** POST /api/v1/notifications/read-all */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.userId, auth.userId), eq(notifications.isRead, false)))

  return apiSuccess({ read: true })
}
