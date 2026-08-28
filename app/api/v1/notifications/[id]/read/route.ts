import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { notifications } from "@/lib/db/schema"

/** POST /api/v1/notifications/[id]/read */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, auth.userId)))

  return apiSuccess({ read: true })
}
