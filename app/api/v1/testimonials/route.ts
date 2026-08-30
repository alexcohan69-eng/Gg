import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { parseFormData } from "@/lib/api-v1-helpers"
import { getTestimonials } from "@/lib/testimonials"
import { addTestimonialForUser } from "@/app/actions/testimonials"

/**
 * GET /api/v1/testimonials — the authenticated key's own
 * testimonials. Requires a valid API key. (For a public read of *any*
 * user's testimonials, see `GET /api/v1/users/:username/testimonials`.)
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const testimonials = await getTestimonials(userId)
    return apiSuccess(testimonials)
  })
}

/**
 * POST /api/v1/testimonials — adds a new testimonial to the
 * authenticated key's own Testimonials tab. Reuses
 * `addTestimonialForUser` from app/actions/testimonials.ts so
 * validation is identical to the web editor.
 */
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const formData = await parseFormData(request)
    const result = await addTestimonialForUser(userId, formData)
    if (!result.success) {
      return apiError(400, "invalid_testimonial", result.error ?? "Couldn't create testimonial.")
    }
    return apiSuccess({ success: true }, 201)
  })
}
