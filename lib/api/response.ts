import { NextResponse, type NextRequest } from "next/server"

/** Consistent success envelope for every /api/v1/* response. */
export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/** Consistent error envelope for every /api/v1/* response: `{ error: { message, code } }`. */
export function apiError(status: number, message: string, code?: string): NextResponse {
  return NextResponse.json(
    { error: { message, code: code ?? defaultCodeForStatus(status) } },
    { status },
  )
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400:
      return "bad_request"
    case 401:
      return "unauthorized"
    case 403:
      return "forbidden"
    case 404:
      return "not_found"
    case 409:
      return "conflict"
    case 413:
      return "payload_too_large"
    case 429:
      return "rate_limited"
    default:
      return status >= 500 ? "server_error" : "error"
  }
}

/**
 * Parses a JSON request body, returning a typed `{ error }` result
 * instead of throwing on malformed JSON — every write route should
 * check `"error" in result` before touching `result.data`.
 */
export async function parseJsonBody<T = unknown>(
  request: NextRequest,
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const data = (await request.json()) as T
    return { data }
  } catch {
    return { error: apiError(400, "Request body must be valid JSON.") }
  }
}

export type Pagination = { limit: number; cursor: string | null }

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

/** Reads `limit`/`cursor` query params with sane defaults and caps, matching the app's own page-size conventions. */
export function parsePagination(request: NextRequest, defaultLimit = DEFAULT_LIMIT): Pagination {
  const url = new URL(request.url)
  const rawLimit = Number(url.searchParams.get("limit"))
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), MAX_LIMIT) : defaultLimit
  const cursor = url.searchParams.get("cursor")
  return { limit, cursor }
}
