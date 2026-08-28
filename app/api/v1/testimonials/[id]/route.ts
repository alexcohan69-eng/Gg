import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { testimonials } from "@/lib/db/schema"
import { getTestimonial } from "@/lib/testimonials"
import { validateTestimonialBody } from "@/app/api/v1/testimonials/route"

/** GET /api/v1/testimonials/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const testimonial = await getTestimonial(auth.userId, id)
  if (!testimonial) return apiError(404, "Testimonial not found.")
  return apiSuccess({ testimonial })
}

/** PATCH /api/v1/testimonials/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await getTestimonial(auth.userId, id)
  if (!existing) return apiError(404, "Testimonial not found.")

  const body = await parseJsonBody<Record<string, unknown>>(request)
  if ("error" in body) return body.error
  const parsed = validateTestimonialBody({ ...existing, ...body.data } as never)
  if ("error" in parsed) return apiError(400, parsed.error)

  await db
    .update(testimonials)
    .set({
      authorName: parsed.authorName,
      authorTitle: parsed.authorTitle,
      authorAvatar: parsed.authorAvatar,
      rating: parsed.rating,
      content: parsed.content,
      projectTitle: parsed.projectTitle,
      updatedAt: new Date(),
    })
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, auth.userId)))

  const updated = await getTestimonial(auth.userId, id)
  return apiSuccess({ testimonial: updated })
}

/** DELETE /api/v1/testimonials/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await getTestimonial(auth.userId, id)
  if (!existing) return apiError(404, "Testimonial not found.")

  await db.delete(testimonials).where(and(eq(testimonials.id, id), eq(testimonials.userId, auth.userId)))
  return apiSuccess({ deleted: true })
}
