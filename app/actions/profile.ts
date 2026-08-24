"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  user as userTable,
  type WorkflowStep,
  type WorkExperience,
} from "@/lib/db/schema"

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
  const profession = String(formData.get("profession") ?? "").trim()

  // Parse the numeric "career highlight" counts. Empty means "clear it"
  // (stored as null); any provided value must be a non-negative integer
  // within a sane cap so a typo can't render absurd figures.
  const parseCount = (key: string): number | null | { error: string } => {
    const raw = String(formData.get(key) ?? "").trim()
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isInteger(n) || n < 0 || n > 100000) {
      return { error: "Highlight numbers must be whole numbers between 0 and 100,000." }
    }
    return n
  }

  const totalClients = parseCount("totalClients")
  const totalProjects = parseCount("totalProjects")
  const yearsExperience = parseCount("yearsExperience")

  // Skills arrive as a comma/newline-separated string; workflow and work
  // history arrive as JSON strings from the repeatable-field editor.
  const skills = String(formData.get("skills") ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40)

  const parseJsonList = <T,>(key: string): T[] => {
    const raw = String(formData.get(key) ?? "").trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as T[]) : []
    } catch {
      return []
    }
  }

  const workflowRaw = parseJsonList<WorkflowStep>("workflow")
  const workflow = workflowRaw
    .map((step) => ({
      title: String(step?.title ?? "").trim().slice(0, 80),
      description: String(step?.description ?? "").trim().slice(0, 300),
    }))
    .filter((step) => step.title || step.description)
    .slice(0, 12)

  const workExperienceRaw = parseJsonList<WorkExperience>("workExperience")
  const workExperience = workExperienceRaw
    .map((job) => ({
      role: String(job?.role ?? "").trim().slice(0, 100),
      company: String(job?.company ?? "").trim().slice(0, 100),
      period: String(job?.period ?? "").trim().slice(0, 60),
      description: String(job?.description ?? "").trim().slice(0, 500),
    }))
    .filter((job) => job.role || job.company || job.description)
    .slice(0, 20)

  if (!name || name.length > 50) {
    return { success: false, error: "Name must be 1-50 characters." }
  }

  if (profession.length > 80) {
    return { success: false, error: "Headline must be 80 characters or fewer." }
  }

  for (const count of [totalClients, totalProjects, yearsExperience]) {
    if (count && typeof count === "object" && "error" in count) {
      return { success: false, error: count.error }
    }
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
      profession: profession || null,
      totalClients: typeof totalClients === "number" ? totalClients : null,
      totalProjects: typeof totalProjects === "number" ? totalProjects : null,
      yearsExperience:
        typeof yearsExperience === "number" ? yearsExperience : null,
      skills,
      workflow,
      workExperience,
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
