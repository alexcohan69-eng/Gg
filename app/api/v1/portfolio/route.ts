import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getPortfolioProjects } from "@/lib/portfolio"
import { addPortfolioProjectForUser } from "@/app/actions/portfolio"

/**
 * GET /api/v1/portfolio — the authenticated key's own case studies.
 * Requires a valid API key. (For a public read of *any* user's work,
 * see `GET /api/v1/users/:username/portfolio`.)
 */
export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const projects = await getPortfolioProjects(userId)
    return apiSuccess(projects)
  })
}

/**
 * POST /api/v1/portfolio — adds a new case study to the authenticated
 * key's own Work tab. Reuses `addPortfolioProjectForUser` from
 * app/actions/portfolio.ts so validation is identical to the web editor.
 */
export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const formData = await request.formData()
    const result = await addPortfolioProjectForUser(userId, formData)
    if (!result.success) {
      return apiError(400, "invalid_project", result.error ?? "Couldn't create project.")
    }
    return apiSuccess({ success: true }, 201)
  })
}
