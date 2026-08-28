"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { del } from "@vercel/blob"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { posts, services, testimonials } from "@/lib/db/schema"
import {
  mediaUrlToPathname,
  validateGalleryMedia,
  type MediaAttachment,
  type MediaType,
} from "@/lib/media"
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

function revalidateServices() {
  revalidatePath("/profile")
  // Both the Services grid and each listing's detail page are keyed
  // by username/id in the URL, so a broad revalidation of the dynamic
  // segments covers every viewer of them.
  revalidatePath("/profile/[username]/services", "page")
  revalidatePath("/profile/[username]/services/[serviceId]", "page")
}

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
const MAX_PACKAGES = 3
const MAX_PACKAGE_NAME = 30
const MAX_PACKAGE_DESCRIPTION = 300
const MAX_PACKAGE_FEATURES = 8
const MAX_PACKAGE_FEATURE_LENGTH = 80

const MEDIA_TYPES: MediaType[] = ["image", "gif", "video"]
function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && (MEDIA_TYPES as string[]).includes(value)
}

/** Parses a client-submitted `{ url, type }` gallery/cover value, dropping anything malformed. */
function parseMediaAttachment(value: unknown): MediaAttachment | null {
  if (!value || typeof value !== "object") return null
  const url = "url" in value ? String((value as { url: unknown }).url ?? "").trim() : ""
  const type = "type" in value ? (value as { type: unknown }).type : "image"
  if (!url) return null
  return { url, type: isMediaType(type) ? type : "image" }
}

type ServicePackageInput = {
  name: string
  price: number
  deliveryDays: number
  description: string
  features: string[]
}

/** Parses + validates the client-submitted JSON array of Basic/Standard/Premium pricing tiers. */
function parsePackagesInput(raw: string): ServicePackageInput[] | { error: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: "Invalid packages." }
  }
  if (!Array.isArray(parsed)) return { error: "Invalid packages." }
  if (parsed.length > MAX_PACKAGES) {
    return { error: `You can add up to ${MAX_PACKAGES} pricing packages.` }
  }

  const packages: ServicePackageInput[] = []
  for (const item of parsed) {
    if (!item || typeof item !== "object") return { error: "Invalid packages." }
    const name = String((item as { name?: unknown }).name ?? "").trim()
    const price = Number((item as { price?: unknown }).price)
    const deliveryDays = Number((item as { deliveryDays?: unknown }).deliveryDays)
    const description = String((item as { description?: unknown }).description ?? "").trim()
    const featuresRaw = (item as { features?: unknown }).features
    const features = Array.isArray(featuresRaw)
      ? featuresRaw.map((f) => String(f).trim()).filter(Boolean)
      : []

    if (!name || name.length > MAX_PACKAGE_NAME) {
      return { error: `Each package name is required and must be ${MAX_PACKAGE_NAME} characters or fewer.` }
    }
    if (!Number.isFinite(price) || !Number.isInteger(price) || price < MIN_PRICE || price > MAX_PRICE) {
      return { error: `Each package price must be a whole number between $${MIN_PRICE} and $${MAX_PRICE.toLocaleString()}.` }
    }
    if (
      !Number.isFinite(deliveryDays) ||
      !Number.isInteger(deliveryDays) ||
      deliveryDays < MIN_DELIVERY_DAYS ||
      deliveryDays > MAX_DELIVERY_DAYS
    ) {
      return { error: `Each package's delivery time must be a whole number of days between ${MIN_DELIVERY_DAYS} and ${MAX_DELIVERY_DAYS}.` }
    }
    if (description.length > MAX_PACKAGE_DESCRIPTION) {
      return { error: `Each package description must be ${MAX_PACKAGE_DESCRIPTION} characters or fewer.` }
    }
    if (features.length > MAX_PACKAGE_FEATURES || features.some((f) => f.length > MAX_PACKAGE_FEATURE_LENGTH)) {
      return { error: `Each package can list up to ${MAX_PACKAGE_FEATURES} features of ${MAX_PACKAGE_FEATURE_LENGTH} characters or fewer.` }
    }

    packages.push({ name, price, deliveryDays, description, features })
  }

  return packages
}

async function assertOwnsService(userId: string, id: string) {
  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.id, id), eq(services.userId, userId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Not found")
}

function parseServiceForm(formData: FormData):
  | {
      title: string
      tagline: string
      startingPrice: number
      deliveryDays: number
      category: string | null
      tags: string[]
      description: string | null
      coverImage: string | null
      coverImageType: MediaType | null
      gallery: MediaAttachment[]
      packages: ServicePackageInput[]
    }
  | { error: string } {
  const title = String(formData.get("title") ?? "").trim()
  const tagline = String(formData.get("tagline") ?? "").trim()
  const category = String(formData.get("category") ?? "").trim() || null
  const coverImage = String(formData.get("coverImage") ?? "").trim() || null
  const coverImageTypeRaw = formData.get("coverImageType")
  const coverImageType = coverImage
    ? isMediaType(coverImageTypeRaw)
      ? coverImageTypeRaw
      : "image"
    : null
  const descriptionHtml = String(formData.get("description") ?? "")

  const startingPrice = Number(formData.get("startingPrice"))
  const deliveryDays = Number(formData.get("deliveryDays"))

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

  let gallery: MediaAttachment[] = []
  const galleryRaw = String(formData.get("gallery") ?? "[]")
  try {
    const parsed = JSON.parse(galleryRaw)
    if (Array.isArray(parsed)) {
      gallery = parsed
        .map((item) => parseMediaAttachment(item))
        .filter((item): item is MediaAttachment => item !== null)
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
  if (
    !Number.isFinite(startingPrice) ||
    !Number.isInteger(startingPrice) ||
    startingPrice < MIN_PRICE ||
    startingPrice > MAX_PRICE
  ) {
    return { error: `Starting price must be a whole number between $${MIN_PRICE} and $${MAX_PRICE.toLocaleString()}.` }
  }
  if (
    !Number.isFinite(deliveryDays) ||
    !Number.isInteger(deliveryDays) ||
    deliveryDays < MIN_DELIVERY_DAYS ||
    deliveryDays > MAX_DELIVERY_DAYS
  ) {
    return { error: `Delivery time must be a whole number of days between ${MIN_DELIVERY_DAYS} and ${MAX_DELIVERY_DAYS}.` }
  }
  if (category && category.length > MAX_CATEGORY) {
    return { error: `Category must be ${MAX_CATEGORY} characters or fewer.` }
  }
  if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) {
    return { error: `You can add up to ${MAX_TAGS} tags of ${MAX_TAG_LENGTH} characters or fewer.` }
  }
  const galleryError = validateGalleryMedia(gallery)
  if (galleryError) {
    return { error: galleryError }
  }

  const packagesRaw = String(formData.get("packages") ?? "[]")
  const packagesResult = parsePackagesInput(packagesRaw)
  if ("error" in packagesResult) {
    return { error: packagesResult.error }
  }

  const sanitizedDescription = descriptionHtml ? sanitizePostHtml(descriptionHtml) : ""
  if (stripHtmlToText(sanitizedDescription).length > MAX_DESCRIPTION_TEXT) {
    return { error: `Description must be ${MAX_DESCRIPTION_TEXT} characters or fewer.` }
  }

  return {
    title,
    tagline,
    startingPrice,
    deliveryDays,
    category,
    tags: [...new Set(tags)],
    description: sanitizedDescription || null,
    coverImage,
    coverImageType,
    gallery,
    packages: packagesResult,
  }
}

/** Adds a new service listing to the end of the profile's Services tab. */
export async function addService(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = parseServiceForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  const existing = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.userId, userId))

  if (existing.length >= MAX_SERVICES) {
    return { success: false, error: `You can add up to ${MAX_SERVICES} services.` }
  }

  await db.insert(services).values({
    id: crypto.randomUUID(),
    userId,
    title: parsed.title,
    tagline: parsed.tagline,
    startingPrice: parsed.startingPrice,
    deliveryDays: parsed.deliveryDays,
    category: parsed.category,
    coverImage: parsed.coverImage,
    coverImageType: parsed.coverImageType,
    description: parsed.description,
    tags: JSON.stringify(parsed.tags),
    gallery: JSON.stringify(parsed.gallery),
    packages: JSON.stringify(parsed.packages),
    sortOrder: existing.length,
  })

  revalidateServices()

  return { success: true }
}

/** Edits an existing service listing. */
export async function updateService(id: string, formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsService(userId, id)

  const existingRows = await db
    .select({ coverImage: services.coverImage, gallery: services.gallery })
    .from(services)
    .where(and(eq(services.id, id), eq(services.userId, userId)))
    .limit(1)

  const parsed = parseServiceForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  await db
    .update(services)
    .set({
      title: parsed.title,
      tagline: parsed.tagline,
      startingPrice: parsed.startingPrice,
      deliveryDays: parsed.deliveryDays,
      category: parsed.category,
      coverImage: parsed.coverImage,
      coverImageType: parsed.coverImageType,
      description: parsed.description,
      tags: JSON.stringify(parsed.tags),
      gallery: JSON.stringify(parsed.gallery),
      packages: JSON.stringify(parsed.packages),
      updatedAt: new Date(),
    })
    .where(and(eq(services.id, id), eq(services.userId, userId)))

  // Best-effort cleanup of any media that was removed from the
  // listing (replaced cover, deleted gallery items). A failure here
  // shouldn't fail the update — the row is already saved.
  const previous = existingRows[0]
  if (previous) {
    const previousGallery = (JSON.parse(previous.gallery || "[]") as unknown[]).map((item) =>
      typeof item === "string" ? item : (item as { url?: string })?.url,
    )
    const previousUrls = [previous.coverImage, ...previousGallery].filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    )
    const nextUrls = new Set(
      [parsed.coverImage, ...parsed.gallery.map((item) => item.url)].filter(Boolean),
    )
    const removedPathnames = previousUrls
      .filter((url) => !nextUrls.has(url))
      .map((url) => mediaUrlToPathname(url))
      .filter((p): p is string => p !== null)

    if (removedPathnames.length) {
      try {
        await del(removedPathnames)
      } catch (error) {
        logActionError("updateServiceMedia", error, { userId, id })
      }
    }
  }

  revalidateServices()

  return { success: true }
}

/** Removes a service listing, along with its cover and gallery images. */
export async function deleteService(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsService(userId, id)

  const rows = await db
    .select({ coverImage: services.coverImage, gallery: services.gallery })
    .from(services)
    .where(and(eq(services.id, id), eq(services.userId, userId)))
    .limit(1)

  await db.delete(services).where(and(eq(services.id, id), eq(services.userId, userId)))

  // No FK constraint (Aurora DSQL has none), so any testimonial
  // linked to this service would otherwise keep pointing at a
  // deleted id — clear the link instead of leaving it dangling.
  await db
    .update(testimonials)
    .set({ serviceId: null })
    .where(and(eq(testimonials.serviceId, id), eq(testimonials.userId, userId)))

  // Same for any post that shared this service to the feed — clear
  // the attachment rather than leave the embedded preview pointing at
  // a deleted row.
  await db
    .update(posts)
    .set({ attachedServiceId: null })
    .where(and(eq(posts.attachedServiceId, id), eq(posts.userId, userId)))

  // Best-effort cleanup of the listing's uploaded images. A failure
  // here shouldn't fail the delete — the row is already gone.
  const row = rows[0]
  if (row) {
    const gallery = (JSON.parse(row.gallery || "[]") as unknown[]).map((item) =>
      typeof item === "string" ? item : (item as { url?: string })?.url,
    )
    const urls = [row.coverImage, ...gallery].filter(
      (url): url is string => typeof url === "string" && url.length > 0,
    )
    const pathnames = urls
      .map((url) => mediaUrlToPathname(url))
      .filter((p): p is string => p !== null)

    if (pathnames.length) {
      try {
        await del(pathnames)
      } catch (error) {
        logActionError("deleteServiceMedia", error, { userId, id })
      }
    }
  }

  revalidateServices()
  revalidatePath("/home")

  return { success: true }
}

/** Swaps a service listing's position with its neighbor to reorder the Services grid. */
export async function moveService(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const userId = await getUserId()

  const rows = await db
    .select({ id: services.id, sortOrder: services.sortOrder })
    .from(services)
    .where(eq(services.userId, userId))
    .orderBy(services.sortOrder)

  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return { success: false, error: "Not found" }

  const swapIndex = direction === "up" ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) return { success: true }

  const current = rows[index]
  const swap = rows[swapIndex]

  await db
    .update(services)
    .set({ sortOrder: swap.sortOrder })
    .where(and(eq(services.id, current.id), eq(services.userId, userId)))
  await db
    .update(services)
    .set({ sortOrder: current.sortOrder })
    .where(and(eq(services.id, swap.id), eq(services.userId, userId)))

  revalidateServices()

  return { success: true }
}
