"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { getPostTextLength, sanitizePostHtml } from "@/lib/sanitize-html"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

export type UpdateProfileResult = {
  success: boolean
  error?: string
}

export async function updateProfile(
  formData: FormData,
): Promise<UpdateProfileResult> {
  const userId = await getUserId()

  const name = String(formData.get("name") ?? "").trim()
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase()
  const bio = String(formData.get("bio") ?? "").trim()
  const website = String(formData.get("website") ?? "").trim()
  const location = String(formData.get("location") ?? "").trim()

  if (!name || name.length > 50) {
    return { success: false, error: "Name must be 1-50 characters." }
  }

  if (!USERNAME_PATTERN.test(username)) {
    return {
      success: false,
      error:
        "Username must be 3-20 characters: letters, numbers, underscores only.",
    }
  }

  if (bio.length > 160) {
    return { success: false, error: "Bio must be 160 characters or fewer." }
  }

  if (website && !/^https?:\/\/.+/.test(website)) {
    return {
      success: false,
      error: "Website must start with http:// or https://",
    }
  }

  const existing = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.username, username))
    .limit(1)

  if (existing.length > 0 && existing[0].id !== userId) {
    return { success: false, error: "That username is already taken." }
  }

  await db
    .update(userTable)
    .set({
      name,
      username,
      bio: bio || null,
      website: website || null,
      location: location || null,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  revalidatePath("/profile")
  revalidatePath("/settings")

  return { success: true }
}

const MAX_ABOUT_LENGTH = 4000

/**
 * Persists the rich-text "About" section shown on the profile's About
 * tab. Kept separate from `bio` (the short one-line intro in the
 * profile header) — this is the longer, formatted write-up and is
 * sanitized the same way post content is before it's stored.
 */
export async function updateAbout(html: string): Promise<UpdateProfileResult> {
  const userId = await getUserId()

  const sanitized = sanitizePostHtml(html)
  const isEmpty = getPostTextLength(sanitized) === 0

  if (!isEmpty && getPostTextLength(sanitized) > MAX_ABOUT_LENGTH) {
    return {
      success: false,
      error: `About section must be ${MAX_ABOUT_LENGTH} characters or fewer.`,
    }
  }

  await db
    .update(userTable)
    .set({
      about: isEmpty ? null : sanitized,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  revalidatePath("/profile")
  revalidatePath("/settings")

  return { success: true }
}

/**
 * Persists the URL of an already-uploaded avatar or banner image (or
 * clears it back to the initials/gradient fallback when `url` is
 * null). The upload itself happens in /api/upload/profile-image —
 * this just writes the resulting URL onto the user row, mirroring
 * updateProfile's shape so the editor can reuse the same result type.
 */
export async function updateProfileImage(
  kind: "avatar" | "banner",
  url: string | null,
): Promise<UpdateProfileResult> {
  const userId = await getUserId()

  await db
    .update(userTable)
    .set({
      ...(kind === "avatar" ? { image: url } : { bannerImage: url }),
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  revalidatePath("/profile")
  revalidatePath("/settings")

  return { success: true }
}
