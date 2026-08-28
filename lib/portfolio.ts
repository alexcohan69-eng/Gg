import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { portfolioProjects } from "@/lib/db/schema"
import type { MediaAttachment, MediaType } from "@/lib/media"

export type PortfolioProject = {
  id: string
  userId: string
  title: string
  tagline: string
  coverImage: string | null
  coverImageType: MediaType
  client: string | null
  externalUrl: string | null
  tags: string[]
  description: string | null
  gallery: MediaAttachment[]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/**
 * `tags` is stored as JSON-encoded TEXT (Aurora DSQL has no JSON/JSONB
 * or array column types) — parse defensively so a null, missing, or
 * malformed value falls back to an empty list instead of throwing.
 * Mirrors the pattern in lib/career.ts.
 */
function parseJsonArray<T>(value: string | null): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/**
 * Gallery is stored as JSON-encoded TEXT array of `{ url, type }`
 * MediaAttachment objects. Rows created before video/GIF galleries
 * existed stored a plain string[] of URLs instead — each of those is
 * upgraded to `{ url, type: "image" }` on read so older projects keep
 * rendering correctly.
 */
function parseGallery(value: string | null): MediaAttachment[] {
  const parsed = parseJsonArray<MediaAttachment | string>(value)
  return parsed
    .map((item) =>
      typeof item === "string"
        ? { url: item, type: "image" as MediaType }
        : item && typeof item.url === "string"
          ? { url: item.url, type: item.type ?? "image" }
          : null,
    )
    .filter((item): item is MediaAttachment => item !== null)
}

function toPortfolioProject(row: {
  id: string
  userId: string
  title: string
  tagline: string
  coverImage: string | null
  coverImageType: string | null
  client: string | null
  externalUrl: string | null
  tags: string | null
  description: string | null
  gallery: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): PortfolioProject {
  return {
    ...row,
    coverImageType: (row.coverImageType as MediaType | null) ?? "image",
    tags: parseJsonArray<string>(row.tags),
    gallery: parseGallery(row.gallery),
  }
}

/** All of a profile's case studies for the Work tab grid, most-recently-ordered first. */
export async function getPortfolioProjects(userId: string): Promise<PortfolioProject[]> {
  const rows = await db
    .select()
    .from(portfolioProjects)
    .where(eq(portfolioProjects.userId, userId))
    .orderBy(asc(portfolioProjects.sortOrder))

  return rows.map(toPortfolioProject)
}

/**
 * Lightweight `{ id, title }` list of a profile's case studies, used
 * to populate the "link this testimonial to a project" picker in the
 * testimonial editor without loading each project's full gallery.
 */
export async function getPortfolioProjectOptions(userId: string): Promise<{ id: string; title: string }[]> {
  const rows = await db
    .select({ id: portfolioProjects.id, title: portfolioProjects.title })
    .from(portfolioProjects)
    .where(eq(portfolioProjects.userId, userId))
    .orderBy(asc(portfolioProjects.sortOrder))

  return rows
}

/** A single case study for the detail page. Returns null if missing or not owned by that user. */
export async function getPortfolioProject(
  userId: string,
  id: string,
): Promise<PortfolioProject | null> {
  const rows = await db
    .select()
    .from(portfolioProjects)
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))
    .limit(1)

  const row = rows[0]
  return row ? toPortfolioProject(row) : null
}
