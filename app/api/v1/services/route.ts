import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { services } from "@/lib/db/schema"
import { getServices } from "@/lib/services"
import { sanitizePostHtml, stripHtmlToText } from "@/lib/sanitize-html"

const MAX_TITLE = 80
const MAX_TAGLINE = 150
const MAX_CATEGORY = 40
const MAX_DESCRIPTION_TEXT = 4000
const MAX_TAGS = 6
const MAX_TAG_LENGTH = 30
const MAX_SERVICES = 30
const MIN_PRICE = 1
const MAX_PRICE = 1_000_000
const MIN_DELIVERY_DAYS = 1
const MAX_DELIVERY_DAYS = 365

type ServiceBody = {
  title: string
  tagline: string
  startingPrice: number
  deliveryDays: number
  category?: string | null
  tags?: string[]
  description?: string | null
  coverImage?: string | null
  coverImageType?: "image" | "gif" | "video" | null
}

export function validateServiceBody(body: Partial<ServiceBody>): { error: string } | ServiceBody {
  const title = String(body.title ?? "").trim()
  const tagline = String(body.tagline ?? "").trim()
  const startingPrice = Number(body.startingPrice)
  const deliveryDays = Number(body.deliveryDays)
  const category = body.category ? String(body.category).trim() : null
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : []
  const descriptionHtml = body.description ? String(body.description) : ""

  if (!title || title.length > MAX_TITLE) return { error: `title is required and must be ${MAX_TITLE} characters or fewer.` }
  if (!tagline || tagline.length > MAX_TAGLINE) return { error: `tagline is required and must be ${MAX_TAGLINE} characters or fewer.` }
  if (!Number.isFinite(startingPrice) || !Number.isInteger(startingPrice) || startingPrice < MIN_PRICE || startingPrice > MAX_PRICE) {
    return { error: `startingPrice must be a whole number between ${MIN_PRICE} and ${MAX_PRICE}.` }
  }
  if (!Number.isFinite(deliveryDays) || !Number.isInteger(deliveryDays) || deliveryDays < MIN_DELIVERY_DAYS || deliveryDays > MAX_DELIVERY_DAYS) {
    return { error: `deliveryDays must be a whole number between ${MIN_DELIVERY_DAYS} and ${MAX_DELIVERY_DAYS}.` }
  }
  if (category && category.length > MAX_CATEGORY) return { error: `category must be ${MAX_CATEGORY} characters or fewer.` }
  if (tags.length > MAX_TAGS || tags.some((t) => t.length > MAX_TAG_LENGTH)) {
    return { error: `You can add up to ${MAX_TAGS} tags of ${MAX_TAG_LENGTH} characters or fewer.` }
  }

  const sanitizedDescription = descriptionHtml ? sanitizePostHtml(descriptionHtml) : ""
  if (stripHtmlToText(sanitizedDescription).length > MAX_DESCRIPTION_TEXT) {
    return { error: `description must be ${MAX_DESCRIPTION_TEXT} characters or fewer.` }
  }

  return {
    title,
    tagline,
    startingPrice,
    deliveryDays,
    category,
    tags: [...new Set(tags)],
    description: sanitizedDescription || null,
    coverImage: body.coverImage ? String(body.coverImage) : null,
    coverImageType: body.coverImage ? body.coverImageType ?? "image" : null,
  }
}

/** GET /api/v1/services — the authenticated user's own service listings. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const results = await getServices(auth.userId)
  return apiSuccess({ services: results })
}

/** POST /api/v1/services — add a new service listing. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<ServiceBody>(request)
  if ("error" in body) return body.error
  const parsed = validateServiceBody(body.data)
  if ("error" in parsed) return apiError(400, parsed.error)

  const existing = await db.select({ id: services.id }).from(services).where(eq(services.userId, auth.userId))
  if (existing.length >= MAX_SERVICES) return apiError(400, `You can add up to ${MAX_SERVICES} services.`)

  const id = crypto.randomUUID()
  await db.insert(services).values({
    id,
    userId: auth.userId,
    title: parsed.title,
    tagline: parsed.tagline,
    startingPrice: parsed.startingPrice,
    deliveryDays: parsed.deliveryDays,
    category: parsed.category,
    coverImage: parsed.coverImage,
    coverImageType: parsed.coverImageType,
    description: parsed.description,
    tags: JSON.stringify(parsed.tags),
    gallery: JSON.stringify([]),
    packages: JSON.stringify([]),
    sortOrder: existing.length,
  })

  return apiSuccess({ id }, 201)
}
