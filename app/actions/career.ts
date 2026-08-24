"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { getSessionWithRetry } from "@/lib/auth"
import { db } from "@/lib/db"
import { user as userTable, workExperience, type WorkflowStep } from "@/lib/db/schema"

async function getUserId() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

export type ActionResult = {
  success: boolean
  error?: string
}

function revalidateProfile() {
  revalidatePath("/profile")
  revalidatePath("/settings")
  // The About page is keyed by username/id in the URL, so a broad
  // revalidation of the dynamic segment covers every viewer of it.
  revalidatePath("/profile/[username]/about", "page")
}

const MAX_STAT = 1_000_000

/** Years of experience, total clients, and total projects — shown in the About page's career highlights strip. */
export async function updateCareerStats(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()

  function parseStat(key: string): number | null {
    const raw = String(formData.get(key) ?? "").trim()
    if (!raw) return null
    const value = Number(raw)
    return value
  }

  const yearsExperience = parseStat("yearsExperience")
  const totalClients = parseStat("totalClients")
  const totalProjects = parseStat("totalProjects")

  for (const [label, value] of [
    ["Years of experience", yearsExperience],
    ["Total clients", totalClients],
    ["Total projects", totalProjects],
  ] as const) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_STAT)) {
      return { success: false, error: `${label} must be a whole number between 0 and ${MAX_STAT}.` }
    }
  }

  await db
    .update(userTable)
    .set({
      yearsExperience,
      totalClients,
      totalProjects,
      updatedAt: new Date(),
    })
    .where(eq(userTable.id, userId))

  revalidateProfile()

  return { success: true }
}

const MAX_SKILLS = 24
const MAX_SKILL_LENGTH = 30

/** Replaces the user's full skills list (tag-style, shown as badges on the About page). */
export async function updateSkills(skills: string[]): Promise<ActionResult> {
  const userId = await getUserId()

  const cleaned = [
    ...new Set(
      skills
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0 && skill.length <= MAX_SKILL_LENGTH),
    ),
  ]

  if (cleaned.length > MAX_SKILLS) {
    return { success: false, error: `You can list up to ${MAX_SKILLS} skills.` }
  }

  await db
    .update(userTable)
    .set({ skills: cleaned, updatedAt: new Date() })
    .where(eq(userTable.id, userId))

  revalidateProfile()

  return { success: true }
}

const MAX_WORKFLOW_STEPS = 8
const MAX_WORKFLOW_TITLE = 60
const MAX_WORKFLOW_DESCRIPTION = 200

/** Replaces the user's full workflow (ordered steps describing how they work with clients). */
export async function updateWorkflowSteps(steps: WorkflowStep[]): Promise<ActionResult> {
  const userId = await getUserId()

  const cleaned = steps
    .map((step) => ({
      title: step.title.trim().slice(0, MAX_WORKFLOW_TITLE),
      description: step.description.trim().slice(0, MAX_WORKFLOW_DESCRIPTION),
    }))
    .filter((step) => step.title.length > 0)

  if (cleaned.length > MAX_WORKFLOW_STEPS) {
    return { success: false, error: `You can list up to ${MAX_WORKFLOW_STEPS} workflow steps.` }
  }

  await db
    .update(userTable)
    .set({ workflowSteps: cleaned, updatedAt: new Date() })
    .where(eq(userTable.id, userId))

  revalidateProfile()

  return { success: true }
}

const MAX_ROLE = 80
const MAX_COMPANY = 80
const MAX_DATE = 30
const MAX_DESCRIPTION = 500
const MAX_EXPERIENCE_ENTRIES = 20

async function assertOwnsExperience(userId: string, id: string) {
  const rows = await db
    .select({ id: workExperience.id })
    .from(workExperience)
    .where(and(eq(workExperience.id, id), eq(workExperience.userId, userId)))
    .limit(1)
  if (rows.length === 0) throw new Error("Not found")
}

function parseExperienceForm(formData: FormData): {
  role: string
  company: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  description: string | null
} | { error: string } {
  const role = String(formData.get("role") ?? "").trim()
  const company = String(formData.get("company") ?? "").trim()
  const startDate = String(formData.get("startDate") ?? "").trim()
  const isCurrent = formData.get("isCurrent") === "on"
  const endDate = isCurrent ? null : String(formData.get("endDate") ?? "").trim() || null
  const description = String(formData.get("description") ?? "").trim() || null

  if (!role || role.length > MAX_ROLE) {
    return { error: `Role is required and must be ${MAX_ROLE} characters or fewer.` }
  }
  if (!company || company.length > MAX_COMPANY) {
    return { error: `Company is required and must be ${MAX_COMPANY} characters or fewer.` }
  }
  if (!startDate || startDate.length > MAX_DATE) {
    return { error: `Start date is required and must be ${MAX_DATE} characters or fewer.` }
  }
  if (endDate && endDate.length > MAX_DATE) {
    return { error: `End date must be ${MAX_DATE} characters or fewer.` }
  }
  if (description && description.length > MAX_DESCRIPTION) {
    return { error: `Description must be ${MAX_DESCRIPTION} characters or fewer.` }
  }

  return { role, company, startDate, endDate, isCurrent, description }
}

/** Adds a new role to the end of the user's experience timeline. */
export async function addWorkExperience(formData: FormData): Promise<ActionResult> {
  const userId = await getUserId()

  const parsed = parseExperienceForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  const existing = await db
    .select({ id: workExperience.id })
    .from(workExperience)
    .where(eq(workExperience.userId, userId))

  if (existing.length >= MAX_EXPERIENCE_ENTRIES) {
    return { success: false, error: `You can add up to ${MAX_EXPERIENCE_ENTRIES} roles.` }
  }

  await db.insert(workExperience).values({
    id: crypto.randomUUID(),
    userId,
    ...parsed,
    sortOrder: existing.length,
  })

  revalidateProfile()

  return { success: true }
}

/** Edits an existing role. */
export async function updateWorkExperience(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsExperience(userId, id)

  const parsed = parseExperienceForm(formData)
  if ("error" in parsed) return { success: false, error: parsed.error }

  await db
    .update(workExperience)
    .set(parsed)
    .where(and(eq(workExperience.id, id), eq(workExperience.userId, userId)))

  revalidateProfile()

  return { success: true }
}

/** Removes a role from the experience timeline. */
export async function deleteWorkExperience(id: string): Promise<ActionResult> {
  const userId = await getUserId()
  await assertOwnsExperience(userId, id)

  await db
    .delete(workExperience)
    .where(and(eq(workExperience.id, id), eq(workExperience.userId, userId)))

  revalidateProfile()

  return { success: true }
}

/** Swaps a role's position with its neighbor to reorder the timeline. */
export async function moveWorkExperience(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const userId = await getUserId()

  const rows = await db
    .select({ id: workExperience.id, sortOrder: workExperience.sortOrder })
    .from(workExperience)
    .where(eq(workExperience.userId, userId))
    .orderBy(workExperience.sortOrder)

  const index = rows.findIndex((row) => row.id === id)
  if (index === -1) return { success: false, error: "Not found" }

  const swapIndex = direction === "up" ? index - 1 : index + 1
  if (swapIndex < 0 || swapIndex >= rows.length) return { success: true }

  const current = rows[index]
  const swap = rows[swapIndex]

  await db
    .update(workExperience)
    .set({ sortOrder: swap.sortOrder })
    .where(and(eq(workExperience.id, current.id), eq(workExperience.userId, userId)))
  await db
    .update(workExperience)
    .set({ sortOrder: current.sortOrder })
    .where(and(eq(workExperience.id, swap.id), eq(workExperience.userId, userId)))

  revalidateProfile()

  return { success: true }
}
