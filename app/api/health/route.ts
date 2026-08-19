// Tables the app cannot run without. If Aurora is ever provisioned
// fresh (zero tables — the exact incident this project already hit
// once), this check fails loudly instead of every page silently
// erroring on first query.
const REQUIRED_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "posts",
  "likes",
  "bookmarks",
  "reposts",
  "follows",
  "notifications",
  "conversations",
  "messages",
] as const

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string }> = {}

  // Importing `@/lib/db` runs its module-level required-env
  // validation (AWS_ROLE_ARN, AWS_REGION, PGHOST, BETTER_AUTH_SECRET).
  // Deferring the import into this try/catch means a missing env var
  // is reported as a structured "env" check failure below instead of
  // crashing the route with an unhandled module-init error.
  try {
    const { sql } = await import("drizzle-orm")
    const { db } = await import("@/lib/db")

    checks.env = { ok: true }

    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    )
    const existing = new Set(result.rows.map((row) => row.table_name))
    const missing = REQUIRED_TABLES.filter((table) => !existing.has(table))

    checks.database = { ok: true }
    checks.schema =
      missing.length === 0
        ? { ok: true }
        : {
            ok: false,
            error: `Missing table(s): ${missing.join(", ")}. Run scripts/bootstrap-schema.mjs.`,
          }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const isEnvError = message.includes("Missing required environment variable")
    checks[isEnvError ? "env" : "database"] = { ok: false, error: message }
  }

  const healthy = Object.values(checks).every((check) => check.ok)

  return Response.json(
    { status: healthy ? "ok" : "degraded", checks },
    { status: healthy ? 200 : 503 },
  )
}
