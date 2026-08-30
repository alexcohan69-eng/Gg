import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getService } from "@/lib/services"
import { updateServiceForUser, deleteServiceForUser } from "@/app/actions/services"

/**
 * `updateServiceForUser`/`deleteServiceForUser` throw a plain "Not
 * found" error (via `assertOwnsService`) when `id` doesn't belong to
 * `userId`, rather than returning an ActionResult — translate that
 * into the standard 404 envelope instead of letting it fall through
 * to a generic 500.
 */
function notFoundResponse(id: string) {
  return apiError(404, "service_not_found", `No service found for id "${id}".`)
}

/** GET /api/v1/services/:id — a single service owned by the authenticated key. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const service = await getService(userId, id)
    if (!service) {
      return apiError(404, "service_not_found", `No service found for id "${id}".`)
    }
    return apiSuccess(service)
  })
}

/**
 * PATCH /api/v1/services/:id — edits a service owned by the
 * authenticated key. Reuses `updateServiceForUser`, which is scoped
 * by userId, so a key can never edit another account's listing.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const formData = await request.formData()
    try {
      const result = await updateServiceForUser(userId, id, formData)
      if (!result.success) {
        return apiError(400, "invalid_service", result.error ?? "Couldn't update service.")
      }
      return apiSuccess({ success: true })
    } catch {
      return notFoundResponse(id)
    }
  })
}

/** DELETE /api/v1/services/:id — removes a service owned by the authenticated key. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    try {
      const result = await deleteServiceForUser(userId, id)
      if (!result.success) {
        return notFoundResponse(id)
      }
      return apiSuccess({ success: true })
    } catch {
      return notFoundResponse(id)
    }
  })
}
