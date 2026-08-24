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
 * Connects to Aurora DSQL via IAM auth over Vercel's OIDC federation —
 * there are no static AWS keys or a DATABASE_URL in this setup. The
 * signer's short-lived auth token is used as the Postgres password and
 * the `pg` pool calls it fresh on every new connection.
 * Note: Aurora DSQL uses `DsqlSigner` from `@aws-sdk/dsql-signer`, not
 * the Aurora PostgreSQL `Signer` from `@aws-sdk/rds-signer` — they
 * produce incompatible tokens. This project's connected resource
 * (`PGHOST` ends in `.dsql.<region>.on.aws`) is DSQL.
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
  // The auth token can be cached for up to 15 minutes (900 seconds);
  // the pool calls this fresh per new connection.
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
  // NOTE: statement_timeout is intentionally NOT set here. `pg` sends it
  // as a startup/session GUC, and Aurora DSQL's Postgres-compatible
  // endpoint rejects unsupported session parameters at connect time
  // ("setting configuration parameter ... not supported"), which fails
  // every connection in the pool. DSQL enforces its own transaction
  // duration limit server-side instead.
})
attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
