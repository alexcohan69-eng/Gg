import type { NextRequest } from "next/server"
import { verifyApiKey } from "@/lib/api/keys"
import { apiError } from "@/lib/api/response"

export type ApiAuthResult =
  | { ok: true; userId: string; keyId: string }
  | { ok: false; response: ReturnType<typeof apiError> }

function extractRawKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim()
  }
  const apiKeyHeader = request.headers.get("x-api-key")
  if (apiKeyHeader) return apiKeyHeader.trim()
  return null
}

/**
 * Authenticates an incoming /api/v1/* request against a personal
 * access key (see lib/api/keys.ts) — accepts either `Authorization:
 * Bearer <key>` or an `x-api-key` header. Every v1 route handler
 * should call this first and return `result.response` directly when
 * `ok` is false.
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const rawKey = extractRawKey(request)
  if (!rawKey) {
    return {
      ok: false,
      response: apiError(
        401,
        "Missing API key. Pass it as 'Authorization: Bearer <key>' or an 'x-api-key' header.",
      ),
    }
  }

  const result = await verifyApiKey(rawKey)
  if (!result) {
    return { ok: false, response: apiError(401, "Invalid or revoked API key.") }
  }

  return { ok: true, userId: result.userId, keyId: result.keyId }
}
