import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { getProfileByIdentifier } from "@/lib/follows"

/** GET /api/v1/users/me — the authenticated key owner's own profile. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const profile = await getProfileByIdentifier(auth.userId)
  if (!profile) return apiError(404, "User not found.")
  return apiSuccess({ user: profile })
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

type UpdateMeBody = {
  name?: string
  username?: string
  bio?: string | null
  website?: string | null
  location?: string | null
}

/** PATCH /api/v1/users/me — update the authenticated user's own profile. */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<UpdateMeBody>(request)
  if ("error" in body) return body.error
  const { name, username, bio, website, location } = body.data

  const update: Record<string, unknown> = { updatedAt: new Date() }

  if (name !== undefined) {
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 50) {
      return apiError(400, "name must be 1-50 characters.")
    }
    update.name = trimmed
  }

  if (username !== undefined) {
    const normalized = username.trim().toLowerCase()
    if (!USERNAME_PATTERN.test(normalized)) {
      return apiError(400, "username must be 3-20 characters: letters, numbers, underscores only.")
    }
    const existing = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, normalized))
      .limit(1)
    if (existing[0] && existing[0].id !== auth.userId) {
      return apiError(409, "That username is already taken.")
    }
    update.username = normalized
  }

  if (bio !== undefined) {
    if (bio && bio.length > 160) return apiError(400, "bio must be 160 characters or fewer.")
    update.bio = bio || null
  }

  if (website !== undefined) {
    if (website && !/^https?:\/\/.+/.test(website)) {
      return apiError(400, "website must start with http:// or https://")
    }
    update.website = website || null
  }

  if (location !== undefined) {
    update.location = location || null
  }

  await db.update(userTable).set(update).where(eq(userTable.id, auth.userId))

  const profile = await getProfileByIdentifier(auth.userId)
  return apiSuccess({ user: profile })
}
