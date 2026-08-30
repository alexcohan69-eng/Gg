import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getFollowCounts, getProfileByIdentifier } from "@/lib/follows"
import { updateProfileForUser } from "@/app/actions/profile"

/**
 * GET /api/v1/me — the authenticated API key's own profile. Requires
 * a valid API key; unlike `GET /api/v1/users/:username`, there is no
 * public/anonymous variant of this route since "me" is meaningless
 * without a key.
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const profile = await getProfileByIdentifier(userId)
    if (!profile) {
      return apiError(404, "user_not_found", "Your account could not be found.")
    }
    const counts = await getFollowCounts(profile.id)

    return apiSuccess({
      ...profile,
      followerCount: counts.followers,
      followingCount: counts.following,
    })
  })
}

/**
 * PATCH /api/v1/me — updates the authenticated key's own profile
 * fields (name, username, bio, website, location). Reuses
 * `updateProfileForUser` from app/actions/profile.ts so validation
 * (username format, bio length, etc.) is identical to the web
 * settings form.
 */
export async function PATCH(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const formData = await request.formData()
    const result = await updateProfileForUser(userId, formData)
    if (!result.success) {
      return apiError(400, "invalid_profile", result.error ?? "Couldn't update profile.")
    }
    const profile = await getProfileByIdentifier(userId)
    return apiSuccess(profile)
  })
}
