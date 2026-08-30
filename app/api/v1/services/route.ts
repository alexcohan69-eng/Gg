import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getServices } from "@/lib/services"
import { addServiceForUser } from "@/app/actions/services"

/**
 * GET /api/v1/services — the authenticated key's own service
 * listings. Requires a valid API key. (For a public read of *any*
 * user's services, see `GET /api/v1/users/:username/services`.)
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const services = await getServices(userId)
    return apiSuccess(services)
  })
}

/**
 * POST /api/v1/services — adds a new service listing to the
 * authenticated key's own Services tab. Reuses `addServiceForUser`
 * from app/actions/services.ts so validation is identical to the web
 * editor.
 */
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const formData = await request.formData()
    const result = await addServiceForUser(userId, formData)
    if (!result.success) {
      return apiError(400, "invalid_service", result.error ?? "Couldn't create service.")
    }
    return apiSuccess({ success: true }, 201)
  })
}
