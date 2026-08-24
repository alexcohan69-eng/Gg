import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { portfolioProjects } from "@/lib/db/schema"

export type PortfolioProject = {
  id: string
  userId: string
  title: string
  tagline: string
  coverImage: string | null
  client: string | null
  externalUrl: string | null
  tags: string[]
  description: string | null
  gallery: string[]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

/**
 * `tags` and `gallery` are stored as JSON-encoded TEXT (Aurora DSQL has
 * no JSON/JSONB or array column types) — parse defensively so a null,
 * missing, or malformed value falls back to an empty list instead of
 * throwing. Mirrors the pattern in lib/career.ts.
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

function toPortfolioProject(row: {
  id: string
  userId: string
  title: string
  tagline: string
  coverImage: string | null
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
    tags: parseJsonArray<string>(row.tags),
    gallery: parseJsonArray<string>(row.gallery),
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
