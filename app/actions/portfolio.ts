"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { portfolioProjects } from "@/lib/db/schema"
import { mediaUrlToPathname } from "@/lib/media"
import { sanitizePostHtml, stripHtmlToText } from "@/lib/sanitize-html"
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

function revalidatePortfolio() {
  revalidatePath("/profile")
  // Both the Work grid and each case-study detail page are keyed by
  // username/id in the URL, so a broad revalidation of the dynamic
  // segments covers every viewer of them.
  revalidatePath("/profile/[username]/work", "page")
  revalidatePath("/profile/[username]/work/[projectId]", "page")
}

const MAX_TITLE = 80
const MAX_TAGLINE = 150
const MAX_CLIENT = 80
const MAX_DESCRIPTION_TEXT = 4000
const MAX_TAGS = 6
const MAX_TAG_LENGTH = 30
const MAX_GALLERY_IMAGES = 6
const MAX_PROJECTS = 30

async function assertOwnsProject(userId: string, id: string) {
  const rows = await db
    .select({ id: portfolioProjects.id })
    .from(portfolioProjects)
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Not found")
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function parseProjectForm(formData: FormData):
  | {
      title: string
      tagline: string
      client: string | null
      externalUrl: string | null
      tags: string[]
      description: string | null
      coverImage: string | null
      gallery: string[]
    }
  | { error: string } {
  const title = String(formData.get("title") ?? "").trim()
  const tagline = String(formData.get("tagline") ?? "").trim()
  const client = String(formData.get("client") ?? "").trim() || null
  const externalUrlRaw = String(formData.get("externalUrl") ?? "").trim()
  const externalUrl = externalUrlRaw || null
  const coverImage = String(formData.get("coverImage") ?? "").trim() || null
  const descriptionHtml = String(formData.get("description") ?? "")

  let tags: string[] = []
  const tagsRaw = String(formData.get("tags") ?? "[]")
  try {
    const parsed = JSON.parse(tagsRaw)
    if (Array.isArray(parsed)) {
      tags = parsed.map((tag) => String(tag).trim()).filter(Boolean)
    }
  } catch {
    return { error: "Invalid tags." }
  }

  let gallery: string[] = []
  const galleryRaw = String(formData.get("gallery") ?? "[]")
  try {
    const parsed = JSON.parse(galleryRaw)
    if (Array.isArray(parsed)) {
      gallery = parsed.map((url) => String(url).trim()).filter(Boolean)
    }
  } catch {
    return { error: "Invalid gallery." }
  }

  if (!title || title.length > MAX_TITLE) {
    return { error: `Title is required and must be ${MAX_TITLE} characters or fewer.` }
  }
  if (!tagline || tagline.length > MAX_TAGLINE) {
    return { error: `Tagline is required and must be ${MAX_TAGLINE} characters or fewer.` }
  }
  if (client && client.length > MAX_CLIENT) {
    return { error: `Client must be ${MAX_CLIENT} characters or fewer.` }
  }
  if (externalUrl && !isHttpUrl(externalUrl)) {
    return { error: "Link must be a valid http(s) URL." }
  }
  if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return { error: `You can add up to ${MAX_TAGS} tags of ${MAX_TAG_LENGTH} characters or fewer.` }
  }
  if (gallery.length > MAX_GALLERY_IMAGES) {
    return { error: `You can add up to ${MAX_GALLERY_IMAGES} gallery images.` }
  }

  const sanitizedDescription = descriptionHtml ? sanitizePostHtml(descriptionHtml) : ""
  if (stripHtmlToText(sanitizedDescription).length > MAX_DESCRIPTION_TEXT) {
    return { error: `Description must be ${MAX_DESCRIPTION_TEXT} characters or fewer.` }
  }

  return {
    title,
    tagline,
    client,
    externalUrl,
    tags: [...new Set(tags)],
    description: sanitizedDescription || null,
    coverImage,
    gallery,
  }
}

/** Adds a new case study to the end of the profile's Work tab. */
export async function addPortfolioProject(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = parseProjectForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  const existing = await db
    .select({ id: portfolioProjects.id })
    .from(portfolioProjects)
    .where(eq(portfolioProjects.userId, userId))

  if (existing.length >= MAX_PROJECTS) {
    return { success: false, error: `You can add up to ${MAX_PROJECTS} projects.` }
  }

  await db.insert(portfolioProjects).values({
    id: crypto.randomUUID(),
    userId,
    title: parsed.title,
    tagline: parsed.tagline,
    client: parsed.client,
    externalUrl: parsed.externalUrl,
    coverImage: parsed.coverImage,
    description: parsed.description,
    tags: JSON.stringify(parsed.tags),
    gallery: JSON.stringify(parsed.gallery),
    sortOrder: existing.length,
  })

  revalidatePortfolio()

  return { success: true }
}

/** Edits an existing case study. */
export async function updatePortfolioProject(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsProject(userId, id)

  const existingRows = await db
    .select({ coverImage: portfolioProjects.coverImage, gallery: portfolioProjects.gallery })
    .from(portfolioProjects)
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))
    .limit(1)

  const parsed = parseProjectForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  await db
    .update(portfolioProjects)
    .set({
      title: parsed.title,
      tagline: parsed.tagline,
      client: parsed.client,
      externalUrl: parsed.externalUrl,
      coverImage: parsed.coverImage,
      description: parsed.description,
      tags: JSON.stringify(parsed.tags),
      gallery: JSON.stringify(parsed.gallery),
      updatedAt: new Date(),
    })
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))

  // Best-effort cleanup of any images that were removed from the
  // project (replaced cover, deleted gallery items). A failure here
  // shouldn't fail the update — the row is already saved.
  const previous = existingRows[0]
  if (previous) {
    const previousUrls = [
      previous.coverImage,
      ...JSON.parse(previous.gallery || "[]"),
    ].filter((url): url is string => typeof url === "string" && url.length > 0)
    const nextUrls = new Set([parsed.coverImage, ...parsed.gallery].filter(Boolean))
    const removedPathnames = previousUrls
      .filter((url) => !nextUrls.has(url))
      .map((url) => mediaUrlToPathname(url))
      .filter((p): p is string => p !== null)

    if (removedPathnames.length) {
      try {
        await del(removedPathnames)
      } catch (error) {
        logActionError("updatePortfolioProjectMedia", error, { userId, id })
      }
    }
  }

  revalidatePortfolio()

  return { success: true }
}

/** Removes a case study, along with its cover and gallery images. */
export async function deletePortfolioProject(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsProject(userId, id)

  const rows = await db
    .select({ coverImage: portfolioProjects.coverImage, gallery: portfolioProjects.gallery })
    .from(portfolioProjects)
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))
    .limit(1)

  await db
    .delete(portfolioProjects)
    .where(and(eq(portfolioProjects.id, id), eq(portfolioProjects.userId, userId)))

  // Best-effort cleanup of the project's uploaded images. A failure
  // here shouldn't fail the delete — the row is already gone.
  const row = rows[0]
  if (row) {
    const urls = [row.coverImage, ...JSON.parse(row.gallery || "[]")].filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    )
    const pathnames = urls
      .map((url) => mediaUrlToPathname(url))
      .filter((p): p is string => p !== null)

    if (pathnames.length) {
      try {
        await del(pathnames)
      } catch (error) {
        logActionError("deletePortfolioProjectMedia", error, { userId, id })
      }
    }
  }

  revalidatePortfolio()

  return { success: true }
}

/** Swaps a case study's position with its neighbor to reorder the Work grid. */
export async function movePortfolioProject(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const userId = await getUserId()

  const rows = await db
    .select({ id: portfolioProjects.id, sortOrder: portfolioProjects.sortOrder })
    .from(portfolioProjects)
    .where(eq(portfolioProjects.userId, userId))
    .orderBy(portfolioProjects.sortOrder)

  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return { success: false, error: "Not found" }

  const swapIndex = direction === "up" ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) return { success: true }

  const current = rows[index]
  const swap = rows[swapIndex]

  await db
    .update(portfolioProjects)
    .set({ sortOrder: swap.sortOrder })
    .where(and(eq(portfolioProjects.id, current.id), eq(portfolioProjects.userId, userId)))
  await db
    .update(portfolioProjects)
    .set({ sortOrder: current.sortOrder })
    .where(and(eq(portfolioProjects.id, swap.id), eq(portfolioProjects.userId, userId)))

  revalidatePortfolio()

  return { success: true }
}
