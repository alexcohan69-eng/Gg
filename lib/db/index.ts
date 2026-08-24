import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { awsCredentialsProvider } from "@vercel/functions/oidc"
import { attachDatabasePool } from "@vercel/functions"
import { assertRequiredEnv } from "@/lib/env"
import * as schema from "./schema"

// Fail fast with a clear message if AWS_ROLE_ARN, AWS_REGION, PGHOST,
// or BETTER_AUTH_SECRET are missing, instead of surfacing an opaque
// connection error later on the first request that touches the DB.
assertRequiredEnv()

/**
 * Connects to Aurora DSQL via IAM auth over Vercel's OIDC
 * federation — there are no static AWS keys or a DATABASE_URL in this
 * setup. The signer's short-lived admin auth token is used as the
 * Postgres password and the `pg` pool refreshes it automatically on
 * demand. Note: DSQL uses its own `DsqlSigner`, not the RDS/Aurora
 * PostgreSQL `Signer` — they produce incompatible tokens.
 */
const signer = new DsqlSigner({
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    clientConfig: { region: process.env.AWS_REGION },
  }),
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST!,
  expiresIn: 900,
})

export const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE || "postgres",
  port: 5432,
  user: process.env.PGUSER || "admin",
  password: () => signer.getDbConnectAdminAuthToken(),
  ssl: { rejectUnauthorized: false },
  max: 20,
  // Without an explicit connection timeout, `pg` waits indefinitely
  // for a new connection to establish — a network blip or an
  // unreachable Aurora endpoint would otherwise hang the request
  // instead of failing fast. 30s (rather than a tighter value) gives
  // enough headroom for the full cold-start chain on a fresh
  // serverless invocation — OIDC token exchange, STS AssumeRole,
  // RDS IAM token signing, then the actual TLS/Postgres handshake —
  // which can otherwise get falsely flagged as a hung connection.
  connectionTimeoutMillis: 30_000,
  // Recycles idle pooled connections so a stuck/half-open socket
  // doesn't sit in the pool indefinitely between requests.
  idleTimeoutMillis: 30_000,
  // Caps how long the server will wait on a single statement. A
  // runaway/blocked query (e.g. lock contention) fails and frees the
  // connection instead of holding it — and the request — forever.
  statement_timeout: 15_000,
})
attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
