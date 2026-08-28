import type { NextRequest } from "next/server"
import { requireApiUser } from "@/lib/api/auth"
import { ApiError, apiSuccess, withApiErrorHandling } from "@/lib/api/respond"
import { createApiKey, listApiKeys } from "@/lib/api-keys"

/**
 * Bootstrap endpoint: creating/listing/revoking keys itself requires
 * an existing session (a raw API key can't be used to mint more API
 * keys) — see `requireApiUser`, which accepts either a Bearer key or
 * a cookie session, so this also works from the settings page's
 * same-origin fetch.
 */
export async function GET(req: NextRequest) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const keys = await listApiKeys(userId)
    return apiSuccess({ apiKeys: keys })
  })
}

export async function POST(req: NextRequest) {
  return withApiErrorHandling(async () => {
    const { userId } = await requireApiUser(req)
    const body = await req.json().catch(() => ({}))
    const name = typeof body.name === "string" ? body.name.slice(0, 100) : ""
    if (!name.trim()) {
      throw new ApiError(400, "invalid_request", "A 'name' field is required, e.g. 'My integration'.")
    }

    const key = await createApiKey(userId, name)
    return apiSuccess(
      {
        id: key.id,
        name,
        key: key.rawKey,
        keyPrefix: key.keyPrefix,
        createdAt: key.createdAt,
        warning: "This is the only time the full key is shown. Store it securely.",
      },
      201,
    )
  })
}
