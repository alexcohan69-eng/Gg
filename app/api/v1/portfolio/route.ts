import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { portfolioProjects } from "@/lib/db/schema"
import { getPortfolioProjects } from "@/lib/portfolio"
import { sanitizePostHtml, stripHtmlToText } from "@/lib/sanitize-html"

const MAX_TITLE = 80
const MAX_TAGLINE = 150
const MAX_CLIENT = 60
const MAX_DESCRIPTION_TEXT = 4000
const MAX_TAGS = 6
const MAX_TAG_LENGTH = 30
const MAX_PROJECTS = 30

type ProjectBody = {
  title: string
  tagline: string
  client?: string | null
  externalUrl?: string | null
  tags?: string[]
  description?: string | null
  coverImage?: string | null
  coverImageType?: "image" | "gif" | "video" | null
}

export function validateProjectBody(body: Partial<ProjectBody>): { error: string } | ProjectBody {
  const title = String(body.title ?? "").trim()
  const tagline = String(body.tagline ?? "").trim()
  const client = body.client ? String(body.client).trim() : null
  const externalUrl = body.externalUrl ? String(body.externalUrl).trim() : null
  const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean) : []
  const descriptionHtml = body.description ? String(body.description) : ""

  if (!title || title.length > MAX_TITLE) return { error: `title is required and must be ${MAX_TITLE} characters or fewer.` }
  if (!tagline || tagline.length > MAX_TAGLINE) return { error: `tagline is required and must be ${MAX_TAGLINE} characters or fewer.` }
  if (client && client.length > MAX_CLIENT) return { error: `client must be ${MAX_CLIENT} characters or fewer.` }
  if (externalUrl && !/^https?:\/\/.+/.test(externalUrl)) return { error: "externalUrl must start with http:// or https://" }
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
    client,
    externalUrl,
    tags: [...new Set(tags)],
    description: sanitizedDescription || null,
    coverImage: body.coverImage ? String(body.coverImage) : null,
    coverImageType: body.coverImage ? body.coverImageType ?? "image" : null,
  }
}

/** GET /api/v1/portfolio — the authenticated user's case studies. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const results = await getPortfolioProjects(auth.userId)
  return apiSuccess({ portfolio: results })
}

/** POST /api/v1/portfolio — add a new case study. */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<ProjectBody>(request)
  if ("error" in body) return body.error
  const parsed = validateProjectBody(body.data)
  if ("error" in parsed) return apiError(400, parsed.error)

  const existing = await db
    .select({ id: portfolioProjects.id })
    .from(portfolioProjects)
    .where(eq(portfolioProjects.userId, auth.userId))
  if (existing.length >= MAX_PROJECTS) return apiError(400, `You can add up to ${MAX_PROJECTS} case studies.`)

  const id = crypto.randomUUID()
  await db.insert(portfolioProjects).values({
    id,
    userId: auth.userId,
    title: parsed.title,
    tagline: parsed.tagline,
    client: parsed.client,
    externalUrl: parsed.externalUrl,
    coverImage: parsed.coverImage,
    coverImageType: parsed.coverImageType,
    description: parsed.description,
    tags: JSON.stringify(parsed.tags),
    gallery: JSON.stringify([]),
    sortOrder: existing.length,
  })

  return apiSuccess({ id }, 201)
}
