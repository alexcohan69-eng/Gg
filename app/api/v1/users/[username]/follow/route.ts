import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { follows } from "@/lib/db/schema"
import { getProfileByIdentifier } from "@/lib/follows"
import { isBlockedEitherWay } from "@/lib/blocks"
import { createNotification } from "@/lib/notifications"

/** POST /api/v1/users/[username]/follow */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { username } = await params
  const profile = await getProfileByIdentifier(username)
  if (!profile) return apiError(404, "User not found.")
  if (profile.id === auth.userId) return apiError(400, "You can't follow yourself.")

  if (await isBlockedEitherWay(auth.userId, profile.id)) {
    return apiError(403, "You can't follow this account.")
  }

  const inserted = await db
    .insert(follows)
    .values({ id: crypto.randomUUID(), followerId: auth.userId, followingId: profile.id })
    .onConflictDoNothing()
    .returning({ id: follows.id })

  if (inserted.length > 0) {
    await createNotification({ recipientId: profile.id, actorId: auth.userId, type: "follow" })
  }

  return apiSuccess({ following: true })
}

/** DELETE /api/v1/users/[username]/follow */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { username } = await params
  const profile = await getProfileByIdentifier(username)
  if (!profile) return apiError(404, "User not found.")

  await db
    .delete(follows)
    .where(and(eq(follows.followerId, auth.userId), eq(follows.followingId, profile.id)))

  return apiSuccess({ following: false })
}
