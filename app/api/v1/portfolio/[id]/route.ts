import { requireApiUser, apiError, apiSuccess, withApiErrorHandling } from "@/lib/api-auth"
import { getPortfolioProject } from "@/lib/portfolio"
import { updatePortfolioProjectForUser, deletePortfolioProjectForUser } from "@/app/actions/portfolio"

/**
 * `updatePortfolioProjectForUser`/`deletePortfolioProjectForUser`
 * throw a plain "Not found" error (via `assertOwnsProject`) when `id`
 * doesn't belong to `userId`, rather than returning an ActionResult —
 * translate that into the standard 404 envelope instead of letting it
 * fall through to a generic 500.
 */
function notFoundResponse(id: string) {
  return apiError(404, "project_not_found", `No project found for id "${id}".`)
}

/** GET /api/v1/portfolio/:id — a single case study owned by the authenticated key. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const project = await getPortfolioProject(userId, id)
    if (!project) {
      return notFoundResponse(id)
    }
    return apiSuccess(project)
  })
}

/**
 * PATCH /api/v1/portfolio/:id — edits a case study owned by the
 * authenticated key. Reuses `updatePortfolioProjectForUser`, which is
 * scoped by userId, so a key can never edit another account's project.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    const formData = await request.formData()
    try {
      const result = await updatePortfolioProjectForUser(userId, id, formData)
      if (!result.success) {
        return apiError(400, "invalid_project", result.error ?? "Couldn't update project.")
      }
      return apiSuccess({ success: true })
    } catch {
      return notFoundResponse(id)
    }
  })
}

/** DELETE /api/v1/portfolio/:id — removes a case study owned by the authenticated key. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiErrorHandling(async () => {
    const userId = await requireApiUser(request)
    const { id } = await params
    try {
      const result = await deletePortfolioProjectForUser(userId, id)
      if (!result.success) {
        return notFoundResponse(id)
      }
      return apiSuccess({ success: true })
    } catch {
      return notFoundResponse(id)
    }
  })
}
