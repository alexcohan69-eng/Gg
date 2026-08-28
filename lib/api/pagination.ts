const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/**
 * Shared `?limit=&cursor=` parsing for list endpoints. `cursor` is an
 * opaque ISO timestamp string (the `createdAt` of the last item seen)
 * — every list endpoint in this API orders newest-first, so a single
 * cursor shape covers all of them without a per-resource keyset
 * encoding scheme.
 */
export function parsePagination(searchParams: URLSearchParams): {
  limit: number
  cursor: Date | null
} {
  const rawLimit = Number(searchParams.get("limit"))
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), MAX_LIMIT) : DEFAULT_LIMIT

  const rawCursor = searchParams.get("cursor")
  const parsedCursor = rawCursor ? new Date(rawCursor) : null
  const cursor = parsedCursor && !Number.isNaN(parsedCursor.getTime()) ? parsedCursor : null

  return { limit, cursor }
}
