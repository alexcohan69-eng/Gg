// Temporary debug script: inserts a portfolio project with a video cover
// pointing at a public test video URL, for manual responsive testing.
// Not part of the app — delete after use.
import pg from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { awsCredentialsProvider } from "@vercel/functions/oidc"

const { Client } = pg

const signer = new DsqlSigner({
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN,
    clientConfig: { region: process.env.AWS_REGION },
  }),
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST,
  expiresIn: 900,
})

const token = await signer.getDbConnectAdminAuthToken()
const client = new Client({
  host: process.env.PGHOST,
  port: 5432,
  user: process.env.PGUSER || "admin",
  password: token,
  database: process.env.PGDATABASE || "postgres",
  ssl: { rejectUnauthorized: false },
})
await client.connect()

const userRes = await client.query(`select id from "user" where username = 'testuser123'`)
if (userRes.rows.length === 0) {
  console.error("testuser123 not found")
  process.exit(1)
}
const userId = userRes.rows[0].id

const id = `test-video-project-${Date.now()}`
await client.query(
  `insert into "portfolioProjects" (id, "userId", title, tagline, "coverImage", "coverImageType", tags, gallery, "sortOrder")
   values ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
  [
    id,
    userId,
    "Video Cover Test",
    "Testing responsive layout with a video cover",
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    "video",
    JSON.stringify([]),
    JSON.stringify([]),
  ],
)

console.log("Inserted project id:", id)
await client.end()
