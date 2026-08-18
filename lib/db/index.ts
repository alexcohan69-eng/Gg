import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { awsCredentialsProvider } from "@vercel/functions/oidc"
import { attachDatabasePool } from "@vercel/functions"
import * as schema from "./schema"

/**
 * Connects to Aurora DSQL via IAM auth over Vercel's OIDC federation —
 * there are no static AWS keys or a DATABASE_URL in this setup. The
 * signer's short-lived token is used as the Postgres password and the
 * `pg` pool refreshes it automatically on demand. DSQL uses its own
 * signer/token format (`DsqlSigner` + `getDbConnectAdminAuthToken`),
 * distinct from classic RDS/Aurora PostgreSQL's `Signer`.
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
})
attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
