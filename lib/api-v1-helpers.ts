import { getProfileByIdentifier, type ProfileUser } from "@/lib/follows"
import { ApiRouteError } from "@/lib/api-auth"

/**
 * Parses a request body as form data (the format every `/api/v1/...`
 * write endpoint expects, matching the /developers docs' `-F` curl
 * examples). `Request.formData()` throws a raw `TypeError` when the
 * `Content-Type` header isn't `multipart/form-data` or
 * `application/x-www-form-urlencoded` (e.g. a caller sends JSON) —
 * without this wrapper that surfaces as an opaque 500, not a helpful
 * 400 telling the caller what went wrong.
 */
export async function parseFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData()
  } catch {
    throw new ApiRouteError(
      400,
      "invalid_content_type",
      "Expected a multipart/form-data or application/x-www-form-urlencoded request body.",
    )
  }
}

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
