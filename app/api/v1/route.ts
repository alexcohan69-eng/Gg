import { apiSuccess } from "@/lib/api/respond"

/**
 * Discoverability root for the public REST API. No auth required —
 * this just tells a developer what exists and how to authenticate.
 */
export async function GET() {
  return apiSuccess({
    name: "Pulse API",
    version: "v1",
    authentication:
      "Send 'Authorization: Bearer <key>'. Generate a key from Settings > API Keys, or POST /api/v1/api-keys with an active browser session.",
    resources: ["api-keys"],
  })
}
