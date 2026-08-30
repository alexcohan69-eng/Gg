import { getProfileByIdentifier, type ProfileUser } from "@/lib/follows"
import { ApiRouteError } from "@/lib/api-auth"

/** Shared pagination clamp for public API list endpoints. */
export function parseLimit(request: Request, fallback = 30, max = 50): number {
  const raw = new URL(request.url).searchParams.get("limit")
  const parsed = raw ? Number.parseInt(raw, 10) : fallback
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

/**
 * Resolves the `:username` path segment to a full profile, or throws a
 * 404 `ApiRouteError` so every `users/:username/...` route gets
 * identical "user not found" behavior.
 */
export async function requireProfileByUsername(username: string): Promise<ProfileUser> {
  const profile = await getProfileByIdentifier(username)
  if (!profile) {
    throw new ApiRouteError(404, "user_not_found", `No user found for "${username}".`)
  }
  return profile
}
