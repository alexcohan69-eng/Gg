import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { user, workExperience, type WorkflowStep } from "@/lib/db/schema"

export type CareerProfile = {
  yearsExperience: number | null
  totalClients: number | null
  totalProjects: number | null
  skills: string[]
  workflowSteps: WorkflowStep[]
}

const EMPTY_CAREER_PROFILE: CareerProfile = {
  yearsExperience: null,
  totalClients: null,
  totalProjects: null,
  skills: [],
  workflowSteps: [],
}

/**
 * Career overview fields for the About page (highlights, skills,
 * workflow). Kept separate from `ProfileUser` in lib/follows.ts so
 * surfaces that don't need this data (blocked-user lists, suggested
 * users, feeds) don't carry it along for every profile row.
 */
export async function getCareerProfile(userId: string): Promise<CareerProfile> {
  const rows = await db
    .select({
      yearsExperience: user.yearsExperience,
      totalClients: user.totalClients,
      totalProjects: user.totalProjects,
      skills: user.skills,
      workflowSteps: user.workflowSteps,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const row = rows[0]
  if (!row) return EMPTY_CAREER_PROFILE

  return {
    yearsExperience: row.yearsExperience,
    totalClients: row.totalClients,
    totalProjects: row.totalProjects,
    skills: row.skills ?? [],
    workflowSteps: row.workflowSteps ?? [],
  }
}

export type WorkExperienceEntry = {
  id: string
  role: string
  company: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  description: string | null
  sortOrder: number
}

/** A user's past roles for the About page timeline, most recent first. */
export async function getWorkExperience(
  userId: string,
): Promise<WorkExperienceEntry[]> {
  return db
    .select({
      id: workExperience.id,
      role: workExperience.role,
      company: workExperience.company,
      startDate: workExperience.startDate,
      endDate: workExperience.endDate,
      isCurrent: workExperience.isCurrent,
      description: workExperience.description,
      sortOrder: workExperience.sortOrder,
    })
    .from(workExperience)
    .where(eq(workExperience.userId, userId))
    .orderBy(asc(workExperience.sortOrder))
}
