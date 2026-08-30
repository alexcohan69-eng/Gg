import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getTestimonial } from "@/lib/testimonials"
import { updateTestimonialForUser, deleteTestimonialForUser } from "@/app/actions/testimonials"

/**
 * `updateTestimonialForUser`/`deleteTestimonialForUser` throw a plain
 * "Not found" error (via `assertOwnsTestimonial`) when `id` doesn't
 * belong to `userId`, rather than returning an ActionResult —
 * translate that into the standard 404 envelope instead of letting it
 * fall through to a generic 500.
 */
function notFoundResponse(id: string) {
  return apiError(404, "testimonial_not_found", `No testimonial found for id "${id}".`)
}

/** GET /api/v1/testimonials/:id — a single testimonial owned by the authenticated key. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const testimonial = await getTestimonial(userId, id)
    if (!testimonial) {
      return notFoundResponse(id)
    }
    return apiSuccess(testimonial)
  })
}

/**
 * PATCH /api/v1/testimonials/:id — edits a testimonial owned by the
 * authenticated key. Reuses `updateTestimonialForUser`, which is
 * scoped by userId, so a key can never edit another account's testimonial.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const formData = await request.formData()
    try {
      const result = await updateTestimonialForUser(userId, id, formData)
      if (!result.success) {
        return apiError(400, "invalid_testimonial", result.error ?? "Couldn't update testimonial.")
      }
      return apiSuccess({ success: true })
    } catch {
      return notFoundResponse(id)
    }
  })
}

/** DELETE /api/v1/testimonials/:id — removes a testimonial owned by the authenticated key. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    try {
      const result = await deleteTestimonialForUser(userId, id)
      if (!result.success) {
        return notFoundResponse(id)
      }
      return apiSuccess({ success: true })
    } catch {
      return notFoundResponse(id)
    }
  })
}
