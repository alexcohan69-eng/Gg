import { NextResponse } from "next/server"
import { verifyApiKey } from "@/lib/api-keys"

/**
 * Request authentication for the public `/api/v1/...` API — separate
 * from the web app's own Better Auth session cookies (see lib/auth.ts).
 * Every public route reads the key via these helpers rather than
 * touching the `Authorization` header directly, so the "missing vs.
 * invalid vs. revoked key" handling stays consistent across all
 * endpoints.
 */

/**
 * A thrown error carrying an HTTP status + machine-readable code,
 * turned into the standard `{ error }` envelope by
 * `withApiErrorHandling`. Used for auth failures (401) here, and
 * reused by route handlers for other request errors (404 "not
 * found", 400 "bad request") so every `app/api/v1/...` route shares
 * one error shape instead of each inventing its own.
 */
export class ApiRouteError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization")
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

/**
 * For public GET endpoints: an API key is optional. If present and
 * valid, returns the owning userId (used to add viewer-specific flags
 * like `likedByViewer`); if absent, returns null. An explicitly
 * invalid/revoked key still throws — a caller who sent a bad key
 * should see a 401, not be silently treated as anonymous.
 */
export async function authenticateApiRequest(request: Request): Promise<{ userId: string | null }> {
  const token = extractBearerToken(request)
  if (!token) return { userId: null }

  const userId = await verifyApiKey(token)
  if (!userId) {
    throw new ApiRouteError(401, "invalid_api_key", "The provided API key is invalid or has been revoked.")
  }
  return { userId }
}

/**
 * For write endpoints and any "me"-scoped read: a valid API key is
 * required. Every mutation route uses the returned userId as the sole
 * source of "who is this request acting as" — never a client-supplied
 * userId field — which is what makes it impossible for a key to act on
 * another account.
 */
export async function requireApiUser(request: Request): Promise<string> {
  const token = extractBearerToken(request)
  if (!token) {
    throw new ApiRouteError(401, "missing_api_key", "Missing API key. Send it as `Authorization: Bearer pk_live_...`.")
  }

  const userId = await verifyApiKey(token)
  if (!userId) {
    throw new ApiRouteError(401, "invalid_api_key", "The provided API key is invalid or has been revoked.")
  }
  return userId
}

/** Consistent success envelope: `{ data }`. */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

/** Consistent error envelope: `{ error: { message, code } }`. */
export function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/**
 * Wraps a route handler body so `ApiRouteError` (and any other thrown
 * error) becomes the standard `{ error }` JSON envelope instead of an
 * unhandled 500 or an uncaught exception. Every `app/api/v1/...` route
 * handler should be written as the callback passed here.
 */
export async function withApiErrorHandling(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    if (error instanceof ApiRouteError) {
      return apiError(error.status, error.code, error.message)
    }
    console.error("[v0] Unhandled public API error:", error)
    return apiError(500, "internal_error", "Something went wrong processing this request.")
  }
}
