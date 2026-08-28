import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { portfolioProjects, services, testimonials } from "@/lib/db/schema"
import { getTestimonials } from "@/lib/testimonials"
import { sanitizePostHtml, stripHtmlToText } from "@/lib/sanitize-html"

const MAX_AUTHOR_NAME = 60
const MAX_AUTHOR_TITLE = 80
const MAX_CONTENT_TEXT = 2000
const MAX_PROJECT_TITLE = 80
const MAX_TESTIMONIALS = 50

type TestimonialBody = {
  authorName: string
  authorTitle?: string | null
  authorAvatar?: string | null
  rating?: number | null
  content: string
  projectTitle?: string | null
  serviceId?: string | null
  projectId?: string | null
}

export function validateTestimonialBody(body: Partial<TestimonialBody>): { error: string } | TestimonialBody {
  const authorName = String(body.authorName ?? "").trim()
  const authorTitle = body.authorTitle ? String(body.authorTitle).trim() : null
  const contentHtml = String(body.content ?? "")
  const projectTitle = body.projectTitle ? String(body.projectTitle).trim() : null
  const rating = body.rating === undefined || body.rating === null ? null : Number(body.rating)

  if (!authorName || authorName.length > MAX_AUTHOR_NAME) {
    return { error: `authorName is required and must be ${MAX_AUTHOR_NAME} characters or fewer.` }
  }
  if (authorTitle && authorTitle.length > MAX_AUTHOR_TITLE) {
    return { error: `authorTitle must be ${MAX_AUTHOR_TITLE} characters or fewer.` }
  }
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: "rating must be a whole number between 1 and 5." }
  }
  if (projectTitle && projectTitle.length > MAX_PROJECT_TITLE) {
    return { error: `projectTitle must be ${MAX_PROJECT_TITLE} characters or fewer.` }
  }

  const sanitizedContent = sanitizePostHtml(contentHtml)
  const text = stripHtmlToText(sanitizedContent)
  if (!text) return { error: "content can't be empty." }
  if (text.length > MAX_CONTENT_TEXT) return { error: `content must be ${MAX_CONTENT_TEXT} characters or fewer.` }

  return {
    authorName,
    authorTitle,
    authorAvatar: body.authorAvatar ? String(body.authorAvatar) : null,
    rating,
    content: sanitizedContent,
    projectTitle,
    serviceId: body.serviceId ? String(body.serviceId) : null,
    projectId: body.projectId ? String(body.projectId) : null,
  }
}

/** GET /api/v1/testimonials — the authenticated user's testimonials. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const results = await getTestimonials(auth.userId)
  return apiSuccess({ testimonials: results })
}

/** POST /api/v1/testimonials — add a new testimonial. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<TestimonialBody>(request)
  if ("error" in body) return body.error
  const parsed = validateTestimonialBody(body.data)
  if ("error" in parsed) return apiError(400, parsed.error)

  const existing = await db.select({ id: testimonials.id }).from(testimonials).where(eq(testimonials.userId, auth.userId))
  if (existing.length >= MAX_TESTIMONIALS) return apiError(400, `You can add up to ${MAX_TESTIMONIALS} testimonials.`)

  // Only trust serviceId/projectId if they're actually owned by this user.
  let serviceId: string | null = null
  let projectId: string | null = null
  if (parsed.serviceId) {
    const [row] = await db.select({ id: services.id }).from(services).where(and(eq(services.id, parsed.serviceId), eq(services.userId, auth.userId))).limit(1)
    if (row) serviceId = row.id
  } else if (parsed.projectId) {
    const [row] = await db.select({ id: portfolioProjects.id }).from(portfolioProjects).where(and(eq(portfolioProjects.id, parsed.projectId), eq(portfolioProjects.userId, auth.userId))).limit(1)
    if (row) projectId = row.id
  }

  const id = crypto.randomUUID()
  await db.insert(testimonials).values({
    id,
    userId: auth.userId,
    serviceId,
    projectId,
    authorName: parsed.authorName,
    authorTitle: parsed.authorTitle,
    authorAvatar: parsed.authorAvatar,
    rating: parsed.rating,
    content: parsed.content,
    projectTitle: parsed.projectTitle,
    media: JSON.stringify([]),
    sortOrder: existing.length,
  })

  return apiSuccess({ id }, 201)
}
