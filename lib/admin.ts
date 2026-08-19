import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionWithRetry } from "@/lib/auth"

/**
 * Minimal admin gating: an allowlist of emails via the `ADMIN_EMAILS`
 * environment variable (comma-separated), rather than a `role` column
 * on `user`. There are no admin accounts in any environment yet, so a
 * DB-backed role would still need a manual first-promotion step —
 * an env var accomplishes the same gating in one config change instead
 * of two, and mirrors how this project already treats trusted-origin
 * lists (see lib/auth.ts).
 */
function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmailSet().has(email.toLowerCase())
}

/**
 * Server Component guard for the `/admin` route tree: redirects
 * non-admins to `/home` instead of exposing a 404 (which would still
 * hint the route exists to a curious signed-in user) or throwing.
 */
export async function requireAdminSession() {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user || !isAdminEmail(session.user.email)) {
    redirect("/home")
  }
  return session
}

/** Server Action guard: throws so the caller's catch block returns a friendly error. */
export async function requireAdminUserId(): Promise<string> {
  const session = await getSessionWithRetry({ headers: await headers() })
  if (!session?.user || !isAdminEmail(session.user.email)) {
    throw new Error("Unauthorized")
  }
  return session.user.id
}

/** Whether the currently signed-in user (if any) is an admin — for nav visibility only, never for gating access. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await getSessionWithRetry({ headers: await headers() })
  return isAdminEmail(session?.user?.email)
}
