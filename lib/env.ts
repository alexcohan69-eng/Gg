/**
 * Fail-fast required environment variable validation.
 *
 * This project has twice shipped with a broken production runtime
 * because a required variable was silently missing:
 *   - Aurora IAM auth (AWS_ROLE_ARN / AWS_REGION / PGHOST) misconfigured
 *     surfaced only as opaque connection errors deep in request handling.
 *   - A missing BETTER_AUTH_SECRET caused a live auth outage that was
 *     only noticed after users hit it.
 *
 * `assertRequiredEnv()` checks all required variables up front and
 * throws a single, clear error listing every missing name, so a
 * misconfigured deploy fails loudly and immediately instead of
 * producing confusing downstream errors later.
 */

/**
 * NOTE: each variable is read with a STATIC `process.env.NAME` access.
 * Bundlers (Turbopack/webpack) replace `process.env.NAME` at build
 * time but cannot resolve a computed `process.env[key]` lookup, so
 * iterating over a list of names and indexing into `process.env`
 * reported every variable as missing even when it was set.
 */
const REQUIRED_ENV_VARS: Record<string, string | undefined> = {
  // Aurora IAM auth (lib/db/index.ts)
  AWS_ROLE_ARN: process.env.AWS_ROLE_ARN,
  AWS_REGION: process.env.AWS_REGION,
  PGHOST: process.env.PGHOST,
  // Better Auth session signing (lib/auth.ts)
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
}

let validated = false

export function assertRequiredEnv() {
  if (validated) return
  const missing = Object.entries(REQUIRED_ENV_VARS)
    .filter(([, value]) => !value)
    .map(([key]) => key)
  if (missing.length > 0) {
    throw new Error(
      `[v0] Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set these in the project's environment configuration before starting the app.`,
    )
  }
  validated = true
}

/**
 * Some preview environments inject V0_RUNTIME_URL with stray quote
 * characters baked into the value (e.g. `"'https://foo.v0.build'"`),
 * which throws when passed straight into `new URL(...)`. Strip any
 * wrapping quotes and validate before trusting the value.
 */
function sanitizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined
  const unquoted = value.trim().replace(/^['"]+|['"]+$/g, "")
  try {
    // eslint-disable-next-line no-new
    new URL(unquoted)
    return unquoted
  } catch {
    return undefined
  }
}

/**
 * Single source of truth for "what origin is this app running at",
 * used by lib/auth.ts (Better Auth baseURL), app/layout.tsx
 * (metadataBase), and lib/telegram/links.ts (webhook registration)
 * so all three always agree on the same domain.
 */
export function getSiteUrl(): string {
  return (
    sanitizeUrl(process.env.BETTER_AUTH_URL) ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : (sanitizeUrl(process.env.V0_RUNTIME_URL) ?? "http://localhost:3000"))
  )
}
