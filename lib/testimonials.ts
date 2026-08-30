import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { testimonials } from "@/lib/db/schema"
import { parseMediaColumn, type MediaAttachment } from "@/lib/media"

export type Testimonial = {
  id: string
  userId: string
  // At most one of the two is ever set — a testimonial is about
  // either a service listing or a portfolio case study, not both.
  serviceId: string | null
  projectId: string | null
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

/**
 * Average rating (1-5) across a profile's rated testimonials, rounded
 * to one decimal — powers the "Rating" stat in the profile hero.
 * Returns null when no testimonial has a rating yet, so callers can
 * show a "New" placeholder instead of a misleading 0.
 */
export async function getAverageRating(userId: string): Promise<number | null> {
  const rows = await db
    .select({ rating: testimonials.rating })
    .from(testimonials)
    .where(eq(testimonials.userId, userId))

  const rated = rows.map((row) => row.rating).filter((rating): rating is number => rating != null)
  if (rated.length === 0) return null

  const average = rated.reduce((sum, rating) => sum + rating, 0) / rated.length
  return Math.round(average * 10) / 10
}

/**
 * Testimonials linked to a specific service listing, in manual sort
 * order — rendered as the "Client reviews" section on that service's
 * detail page.
 */
export async function getTestimonialsForService(userId: string, serviceId: string): Promise<Testimonial[]> {
  const rows = await db
    .select()
    .from(testimonials)
    .where(and(eq(testimonials.userId, userId), eq(testimonials.serviceId, serviceId)))
    .orderBy(asc(testimonials.sortOrder))

  return rows.map(rowToTestimonial)
}

/**
 * Testimonials linked to a specific portfolio project, in manual sort
 * order — rendered as the "Client reviews" section on that project's
 * detail page.
 */
export async function getTestimonialsForProject(userId: string, projectId: string): Promise<Testimonial[]> {
  const rows = await db
    .select()
    .from(testimonials)
    .where(and(eq(testimonials.userId, userId), eq(testimonials.projectId, projectId)))
    .orderBy(asc(testimonials.sortOrder))

  return rows.map(rowToTestimonial)
}
