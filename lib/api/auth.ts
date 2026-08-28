import type { NextRequest } from "next/server"
import { verifyApiKey } from "@/lib/api-keys"
import { auth } from "@/lib/auth"
import { ApiError } from "@/lib/api/respond"

/**
 * Resolves the caller of a `/api/v1/*` request to a userId.
 *
 * Tries, in order:
 *  1. `Authorization: Bearer <personal API key>` — the primary path
 *     for third-party developers with no browser session.
 *  2. The existing Better Auth cookie session — so the same route
 *     also works for same-origin `fetch()` calls from the app itself
 *     (e.g. the settings page bootstrapping its first API key).
 *
 * Throws `ApiError(401, ...)` if neither resolves, so every route can
 * just `const { userId } = await requireApiUser(req)` and let the
 * shared error handler turn a failure into a 401 JSON response.
 */
export async function requireApiUser(req: NextRequest): Promise<{ userId: string; via: "api_key" | "session" }> {
  const authHeader = req.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice("Bearer ".length).trim()
    const result = await verifyApiKey(rawKey)
    if (!result) {
      throw new ApiError(401, "invalid_api_key", "The provided API key is invalid or has been revoked.")
    }
    return { userId: result.userId, via: "api_key" }
  }

  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) {
    throw new ApiError(
      401,
      "unauthorized",
      "Provide an API key via 'Authorization: Bearer <key>' or an authenticated session.",
    )
  }
  return { userId: session.user.id, via: "session" }
}
