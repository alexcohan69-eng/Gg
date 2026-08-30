import { apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { requireProfileByUsername } from "@/lib/api-v1-helpers"
import { getPortfolioProjects } from "@/lib/portfolio"

/** GET /api/v1/users/:username/portfolio — a user's public case studies. No API key required. */
export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  return withApiErrorHandling(async () => {
    const { username } = await params
    const profile = await requireProfileByUsername(username)
    const projects = await getPortfolioProjects(profile.id)
    return apiSuccess(projects)
  })
}
