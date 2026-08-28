import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { authenticateApiRequest } from "@/lib/api/auth"
import { apiError, apiSuccess, parseJsonBody } from "@/lib/api/response"
import { db } from "@/lib/db"
import { user as userTable, type WorkflowStep } from "@/lib/db/schema"
import { getCareerProfile, getWorkExperience } from "@/lib/career"

/** GET /api/v1/career — the authenticated user's career overview + work experience. */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const [profile, experience] = await Promise.all([
    getCareerProfile(auth.userId),
    getWorkExperience(auth.userId),
  ])

  return apiSuccess({ career: profile, experience })
}

const MAX_SKILLS = 20
const MAX_SKILL_LENGTH = 30
const MAX_WORKFLOW_STEPS = 10

type CareerBody = {
  yearsExperience?: number | null
  totalClients?: number | null
  totalProjects?: number | null
  skills?: string[]
  workflowSteps?: WorkflowStep[]
}

/** PATCH /api/v1/career — update career overview fields (stats, skills, workflow). */
export async function PATCH(request: NextRequest) {
  const auth = await authenticateApiRequest(request)
  if (!auth.ok) return auth.response

  const body = await parseJsonBody<CareerBody>(request)
  if ("error" in body) return body.error
  const { yearsExperience, totalClients, totalProjects, skills, workflowSteps } = body.data

  const update: Record<string, unknown> = { updatedAt: new Date() }

  for (const [key, value] of Object.entries({ yearsExperience, totalClients, totalProjects })) {
    if (value === undefined) continue
    if (value !== null && (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)) {
      return apiError(400, `${key} must be a non-negative whole number.`)
    }
    update[key] = value
  }

  if (skills !== undefined) {
    if (!Array.isArray(skills) || skills.length > MAX_SKILLS || skills.some((s) => typeof s !== "string" || s.length > MAX_SKILL_LENGTH)) {
      return apiError(400, `skills must be an array of up to ${MAX_SKILLS} strings of ${MAX_SKILL_LENGTH} characters or fewer.`)
    }
    update.skills = JSON.stringify(skills)
  }

  if (workflowSteps !== undefined) {
    if (
      !Array.isArray(workflowSteps) ||
      workflowSteps.length > MAX_WORKFLOW_STEPS ||
      workflowSteps.some((s) => typeof s?.title !== "string" || typeof s?.description !== "string")
    ) {
      return apiError(400, `workflowSteps must be an array of up to ${MAX_WORKFLOW_STEPS} { title, description } objects.`)
    }
    update.workflowSteps = JSON.stringify(workflowSteps)
  }

  await db.update(userTable).set(update).where(eq(userTable.id, auth.userId))

  const profile = await getCareerProfile(auth.userId)
  return apiSuccess({ career: profile })
}
