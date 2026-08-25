import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { services } from "@/lib/db/schema"
import type { MediaAttachment, MediaType } from "@/lib/media"

export type Service = {
  id: string
  userId: string
  title: string
  tagline: string
  coverImage: string | null
  coverImageType: MediaType
  startingPrice: number
  deliveryDays: number
  category: string | null
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
 * Mirrors the pattern in lib/portfolio.ts.
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

/** Gallery is stored as JSON-encoded TEXT array of `{ url, type }` MediaAttachment objects. */
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

function toService(row: {
  id: string
  userId: string
  title: string
  tagline: string
  coverImage: string | null
  coverImageType: string | null
  startingPrice: number
  deliveryDays: number
  category: string | null
  tags: string | null
  description: string | null
  gallery: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): Service {
  return {
    ...row,
    coverImageType: (row.coverImageType as MediaType | null) ?? "image",
    tags: parseJsonArray<string>(row.tags),
    gallery: parseGallery(row.gallery),
  }
}

/** All of a profile's service listings for the Services tab grid, in manual sort order. */
export async function getServices(userId: string): Promise<Service[]> {
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.userId, userId))
    .orderBy(asc(services.sortOrder))

  return rows.map(toService)
}

/** A single service listing for the detail page. Returns null if missing or not owned by that user. */
export async function getService(userId: string, id: string): Promise<Service | null> {
  const rows = await db
    .select()
    .from(services)
    .where(and(eq(services.id, id), eq(services.userId, userId)))
    .limit(1)

  const row = rows[0]
  return row ? toService(row) : null
}
