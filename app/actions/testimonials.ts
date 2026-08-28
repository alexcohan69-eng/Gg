"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { testimonials } from "@/lib/db/schema"
import { mediaUrlToPathname } from "@/lib/media"
import { logActionError } from "@/lib/log-action-error"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type ActionResult = {
  success: boolean
  error?: string
}

function revalidateTestimonials() {
  revalidatePath("/profile")
  revalidatePath("/profile/[username]/testimonials", "page")
}

const MAX_AUTHOR_NAME = 60
const MAX_AUTHOR_TITLE = 80
const MAX_PROJECT_TITLE = 80
const MAX_CONTENT = 600
const MAX_TESTIMONIALS = 30
const MIN_RATING = 1
const MAX_RATING = 5

async function assertOwnsTestimonial(userId: string, id: string) {
  const rows = await db
    .select({ id: testimonials.id })
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Not found")
}

function parseTestimonialForm(formData: FormData):
  | {
      authorName: string
      authorTitle: string | null
      authorAvatar: string | null
      rating: number | null
      content: string
      projectTitle: string | null
    }
  | { error: string } {
  const authorName = String(formData.get("authorName") ?? "").trim()
  const authorTitle = String(formData.get("authorTitle") ?? "").trim() || null
  const authorAvatar = String(formData.get("authorAvatar") ?? "").trim() || null
  const projectTitle = String(formData.get("projectTitle") ?? "").trim() || null
  const content = String(formData.get("content") ?? "").trim()

  const ratingRaw = String(formData.get("rating") ?? "").trim()
  const rating = ratingRaw ? Number(ratingRaw) : null

  if (!authorName || authorName.length > MAX_AUTHOR_NAME) {
    return { error: `Client name is required and must be ${MAX_AUTHOR_NAME} characters or fewer.` }
  }
  if (authorTitle && authorTitle.length > MAX_AUTHOR_TITLE) {
    return { error: `Client title must be ${MAX_AUTHOR_TITLE} characters or fewer.` }
  }
  if (projectTitle && projectTitle.length > MAX_PROJECT_TITLE) {
    return { error: `Project label must be ${MAX_PROJECT_TITLE} characters or fewer.` }
  }
  if (!content || content.length > MAX_CONTENT) {
    return { error: `Testimonial is required and must be ${MAX_CONTENT} characters or fewer.` }
  }
  if (rating !== null && (!Number.isFinite(rating) || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING)) {
    return { error: `Rating must be a whole number between ${MIN_RATING} and ${MAX_RATING}.` }
  }

  return { authorName, authorTitle, authorAvatar, rating, content, projectTitle }
}

/** Adds a new testimonial to the end of the profile's Testimonials tab. */
export async function addTestimonial(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = parseTestimonialForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  const existing = await db
    .select({ id: testimonials.id })
    .from(testimonials)
    .where(eq(testimonials.userId, userId))

  if (existing.length >= MAX_TESTIMONIALS) {
    return { success: false, error: `You can add up to ${MAX_TESTIMONIALS} testimonials.` }
  }

  await db.insert(testimonials).values({
    id: crypto.randomUUID(),
    userId,
    authorName: parsed.authorName,
    authorTitle: parsed.authorTitle,
    authorAvatar: parsed.authorAvatar,
    rating: parsed.rating,
    content: parsed.content,
    projectTitle: parsed.projectTitle,
    sortOrder: existing.length,
  })

  revalidateTestimonials()

  return { success: true }
}

/** Edits an existing testimonial. */
export async function updateTestimonial(id: string, formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsTestimonial(userId, id)

  const existingRows = await db
    .select({ authorAvatar: testimonials.authorAvatar })
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)

  const parsed = parseTestimonialForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  await db
    .update(testimonials)
    .set({
      authorName: parsed.authorName,
      authorTitle: parsed.authorTitle,
      authorAvatar: parsed.authorAvatar,
      rating: parsed.rating,
      content: parsed.content,
      projectTitle: parsed.projectTitle,
      updatedAt: new Date(),
    })
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))

  // Best-effort cleanup of a replaced avatar. A failure here shouldn't
  // fail the update — the row is already saved.
  const previousAvatar = existingRows[0]?.authorAvatar
  if (previousAvatar && previousAvatar !== parsed.authorAvatar) {
    const pathname = mediaUrlToPathname(previousAvatar)
    if (pathname) {
      try {
        await del(pathname)
      } catch (error) {
        logActionError("updateTestimonialAvatar", error, { userId, id })
      }
    }
  }

  revalidateTestimonials()

  return { success: true }
}

/** Removes a testimonial, along with its author avatar. */
export async function deleteTestimonial(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsTestimonial(userId, id)

  const rows = await db
    .select({ authorAvatar: testimonials.authorAvatar })
    .from(testimonials)
    .where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))
    .limit(1)

  await db.delete(testimonials).where(and(eq(testimonials.id, id), eq(testimonials.userId, userId)))

  const avatar = rows[0]?.authorAvatar
  if (avatar) {
    const pathname = mediaUrlToPathname(avatar)
    if (pathname) {
      try {
        await del(pathname)
      } catch (error) {
        logActionError("deleteTestimonialAvatar", error, { userId, id })
      }
    }
  }

  revalidateTestimonials()

  return { success: true }
}

/** Swaps a testimonial's position with its neighbor to reorder the Testimonials grid. */
export async function moveTestimonial(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const userId = await getUserId()

  const rows = await db
    .select({ id: testimonials.id, sortOrder: testimonials.sortOrder })
    .from(testimonials)
    .where(eq(testimonials.userId, userId))
    .orderBy(testimonials.sortOrder)

  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return { success: false, error: "Not found" }

  const swapIndex = direction === "up" ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) return { success: true }

  const current = rows[index]
  const swap = rows[swapIndex]

  await db
    .update(testimonials)
    .set({ sortOrder: swap.sortOrder })
    .where(and(eq(testimonials.id, current.id), eq(testimonials.userId, userId)))
  await db
    .update(testimonials)
    .set({ sortOrder: current.sortOrder })
    .where(and(eq(testimonials.id, swap.id), eq(testimonials.userId, userId)))

  revalidateTestimonials()

  return { success: true }
}
