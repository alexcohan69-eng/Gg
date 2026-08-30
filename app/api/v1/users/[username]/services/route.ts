import { apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { requireProfileByUsername } from "@/lib/api-v1-helpers"
import { getServices } from "@/lib/services"

/** GET /api/v1/users/:username/services — a user's public service listings. No API key required. */
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const { username } = await params
    const profile = await requireProfileByUsername(username)
    const services = await getServices(profile.id)
    return apiSuccess(services)
  })
}
