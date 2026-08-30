import { apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { requireProfileByUsername } from "@/lib/api-v1-helpers"
import { getTestimonials } from "@/lib/testimonials"

/** GET /api/v1/users/:username/testimonials — a user's public client testimonials. No API key required. */
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const { username } = await params
    const profile = await requireProfileByUsername(username)
    const testimonials = await getTestimonials(profile.id)
    return apiSuccess(testimonials)
  })
}
