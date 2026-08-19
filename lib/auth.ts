import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"

export const auth = betterAuth({
  database: pool,
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === "development"
      ? [
          "http://localhost:3000",
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
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
 * hiccup (cold-start connection delay, a dropped connection, etc.)
 * throws instead of resolving. That's called from the root `(app)`
 * layout on every authenticated page, so letting it throw would take
 * the whole app down to the error boundary on a hiccup that a retry
 * would likely clear. Degrade to "no session" instead — the caller's
 * existing unauthenticated path (redirect to sign-in) already handles
 * that safely, and the user can simply retry.
 */
export async function getSessionSafe(
  ...args: Parameters<typeof auth.api.getSession>
) {
  try {
    return await auth.api.getSession(...args)
  } catch (error) {
    console.error("[v0] getSession failed, treating as signed out:", error)
    return null
  }
}
