import { and, eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { portfolioProjects, testimonials } from "@/lib/db/schema"
import { getPortfolioProject } from "@/lib/portfolio"
import { validateProjectBody } from "@/app/api/v1/portfolio/route"

/** GET /api/v1/portfolio/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const project = await getPortfolioProject(auth.userId, id)
  if (!project) return apiError(404, "Project not found.")
  return apiSuccess({ project })
}

/** PATCH /api/v1/portfolio/[id] */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await getPortfolioProject(auth.userId, id)
  if (!existing) return apiError(404, "Project not found.")

  const body = await parseJsonBody<Record<string, unknown>>(request)
  if ("error" in body) return body.error
  const parsed = validateProjectBody({ ...existing, ...body.data } as never)
  if ("error" in parsed) return apiError(400, parsed.error)

  await db
    .update(portfolioProjects)
    .set({
      title: parsed.title,
      tagline: parsed.tagline,
      client: parsed.client,
      externalUrl: parsed.externalUrl,
      coverImage: parsed.coverImage,
      coverImageType: parsed.coverImageType,
      description: parsed.description,
      tags: JSON.stringify(parsed.tags),
      updatedAt: new Date(),
    })
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, auth.userId)))

  const updated = await getPortfolioProject(auth.userId, id)
  return apiSuccess({ project: updated })
}

/** DELETE /api/v1/portfolio/[id] */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const existing = await getPortfolioProject(auth.userId, id)
  if (!existing) return apiError(404, "Project not found.")

  await db.delete(portfolioProjects).where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, auth.userId)))
  await db
    .update(testimonials)
    .set({ projectId: null })
    .where(and(eq(testimonials.projectId, id), eq(testimonials.userId, auth.userId)))

  return apiSuccess({ deleted: true })
}
