import { and, eq, or } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess } from "@/lib/api/response"
import { db } from "@/lib/db"
import { blocks, follows } from "@/lib/db/schema"
import { getProfileByIdentifier } from "@/lib/follows"

/** POST /api/v1/users/[username]/block */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { username } = await params
  const profile = await getProfileByIdentifier(username)
  if (!profile) return apiError(404, "User not found.")
  if (profile.id === auth.userId) return apiError(400, "You can't block yourself.")

  await db.transaction(async (tx) => {
    await tx
      .insert(blocks)
      .values({ id: crypto.randomUUID(), blockerId: auth.userId, blockedId: profile.id })
      .onConflictDoNothing()

    await tx
      .delete(follows)
      .where(
        or(
          and(eq(follows.followerId, auth.userId), eq(follows.followingId, profile.id)),
          and(eq(follows.followerId, profile.id), eq(follows.followingId, auth.userId)),
        ),
      )
  })

  return apiSuccess({ blocked: true })
}

/** DELETE /api/v1/users/[username]/block */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { username } = await params
  const profile = await getProfileByIdentifier(username)
  if (!profile) return apiError(404, "User not found.")

  await db.delete(blocks).where(and(eq(blocks.blockerId, auth.userId), eq(blocks.blockedId, profile.id)))

  return apiSuccess({ blocked: false })
}
