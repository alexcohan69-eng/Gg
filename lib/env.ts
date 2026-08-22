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
