import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import { Signer } from "@aws-sdk/rds-signer"
import { awsCredentialsProvider } from "@vercel/functions/oidc"
import { attachDatabasePool } from "@vercel/functions"
import * as schema from "./schema"

/**
 * Connects to Aurora PostgreSQL via IAM auth over Vercel's OIDC
 * federation — there are no static AWS keys or a DATABASE_URL in this
 * setup. The signer's short-lived token is used as the Postgres
 * password and the `pg` pool refreshes it automatically on demand.
 */
const signer = new Signer({
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    clientConfig: { region: process.env.AWS_REGION },
  }),
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST!,
  username: process.env.PGUSER || "postgres",
  port: 5432,
})

export const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE || "postgres",
  port: 5432,
  user: process.env.PGUSER || "postgres",
  password: () => signer.getAuthToken(),
  ssl: { rejectUnauthorized: false },
  max: 20,
})
attachDatabasePool(pool)

export const db = drizzle(pool, { schema })
