import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { testimonials } from "@/lib/db/schema"
import { parseMediaColumn, type MediaAttachment } from "@/lib/media"

export type Testimonial = {
  id: string
  userId: string
  authorName: string
  authorTitle: string | null
  authorAvatar: string | null
  rating: number | null
  content: string
  projectTitle: string | null
  media: MediaAttachment[]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

type TestimonialRow = Omit<Testimonial, "media"> & { media: string | null }

function rowToTestimonial(row: TestimonialRow): Testimonial {
  return { ...row, media: parseMediaColumn(row.media) }
}

/** All of a profile's testimonials for the Testimonials tab grid, in manual sort order. */
export async function getTestimonials(userId: string): Promise<Testimonial[]> {
  const rows = await db
    .select()
    .from(testimonials)
    .where(eq(testimonials.userId, userId))
    .orderBy(asc(testimonials.sortOrder))

  return rows.map(rowToTestimonial)
}

/** A single testimonial. Returns null if missing or not owned by that user. */
export async function getTestimonial(userId: string, id: string): Promise<Testimonial | null> {
  const rows = await db
    .select()
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)

  return rows[0] ? rowToTestimonial(rows[0]) : null
}
