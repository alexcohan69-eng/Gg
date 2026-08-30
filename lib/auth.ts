import { cache } from "react"
import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import { getSiteUrl } from "@/lib/env"

export const auth = betterAuth({
  database: pool,
  baseURL: getSiteUrl(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === "development"
      ? [
          "http://localhost:3000",
          getSiteUrl(),
          "https://*.vusercontent.net",
          "https://*.vercel.run",
          "https://*.v0.build",
        ]
      : []),
    ...(process.env.NODE_ENV === "production"
      ? [
          ...(process.env.VERCEL_URL
            ? [`https://${process.env.VERCEL_URL}`]
            : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: true },
      bio: { type: "string", required: false, input: true },
      bannerImage: { type: "string", required: false, input: true },
      website: { type: "string", required: false, input: true },
      location: { type: "string", required: false, input: true },
    },
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})

/**
 * `auth.api.getSession` hits the database, so a transient Aurora
 * hiccup (a dropped/half-open pooled connection, a brief cold-start
 * blip, etc.) can throw instead of resolving. This is called from the
 * root `(app)` layout on every authenticated page, so a single failed
 * attempt should not take the whole app down.
 *
 * IMPORTANT: we do NOT swallow the error into a `null` "no session"
 * result. Doing so would force-sign-out a logged-in user on a purely
 * transient failure (the `(app)` layout redirects to `/sign-in` when
 * the session is falsy). Instead we retry a bounded number of times
 * and, if it still fails, re-throw so the Next.js error boundary shows
 * a retryable error rather than an incorrect signed-out state.
 *
 * A genuine "not logged in" resolves to `null` WITHOUT throwing, so
 * real logouts still redirect correctly and are never retried.
 *
 * Wrapped in React's `cache()` because every authenticated route hits
 * this at least twice in the same request — once in the `(app)`
 * layout and once in the page itself, plus a third time in
 * `generateMetadata` on pages that have one — all with the same
 * `headers()` value. Without memoizing, that's 2-3 redundant session
 * lookups (each a DB round trip through Better Auth) per page view.
 * `cache()` scopes the memoization to a single request/render pass,
 * so this can't leak session data across users or requests, and a
 * throw is not cached — the next call in the same request retries
 * from scratch rather than replaying a failure.
 */
export const getSessionWithRetry = cache(async function getSessionWithRetry(
  ...args: Parameters<typeof auth.api.getSession>
) {
  const maxAttempts = 2
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await auth.api.getSession(...args)
    } catch (error) {
      lastError = error
      console.error(
        `[v0] getSession attempt ${attempt}/${maxAttempts} failed:`,
        error,
      )
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
  }
  // Surface the real failure — never masquerade a DB error as signed out.
  throw lastError
})
