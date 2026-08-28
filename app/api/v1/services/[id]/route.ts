import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { services, testimonials, posts } from "@/lib/db/schema"
import { getService } from "@/lib/services"
import { validateServiceBody } from "@/app/api/v1/services/route"

/** GET /api/v1/services/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const service = await getService(auth.userId, id)
  if (!service) return apiError(404, "Service not found.")
  return apiSuccess({ service })
}

/** PATCH /api/v1/services/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await getService(auth.userId, id)
  if (!existing) return apiError(404, "Service not found.")

  const body = await parseJsonBody<Record<string, unknown>>(request)
  if ("error" in body) return body.error
  const parsed = validateServiceBody({ ...existing, ...body.data } as never)
  if ("error" in parsed) return apiError(400, parsed.error)

  await db
    .update(services)
    .set({
      title: parsed.title,
      tagline: parsed.tagline,
      startingPrice: parsed.startingPrice,
      deliveryDays: parsed.deliveryDays,
      category: parsed.category,
      coverImage: parsed.coverImage,
      coverImageType: parsed.coverImageType,
      description: parsed.description,
      tags: JSON.stringify(parsed.tags),
      updatedAt: new Date(),
    })
    .where(and(eq(services.id, id), eq(services.userId, auth.userId)))

  const updated = await getService(auth.userId, id)
  return apiSuccess({ service: updated })
}

/** DELETE /api/v1/services/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await getService(auth.userId, id)
  if (!existing) return apiError(404, "Service not found.")

  await db.delete(services).where(and(eq(services.id, id), eq(services.userId, auth.userId)))
  await db
    .update(testimonials)
    .set({ serviceId: null })
    .where(and(eq(testimonials.serviceId, id), eq(testimonials.userId, auth.userId)))
  await db
    .update(posts)
    .set({ attachedServiceId: null })
    .where(and(eq(posts.attachedServiceId, id), eq(posts.userId, auth.userId)))

  return apiSuccess({ deleted: true })
}
