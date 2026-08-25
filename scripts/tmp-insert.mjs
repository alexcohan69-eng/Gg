import pg from "pg"
import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { awsCredentialsProvider } from "@vercel/functions/oidc"
const { Client } = pg
const signer = new DsqlSigner({
  credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN, clientConfig: { region: process.env.AWS_REGION } }),
  region: process.env.AWS_REGION, hostname: process.env.PGHOST, expiresIn: 900,
})
const token = await signer.getDbConnectAdminAuthToken()
const client = new Client({ host: process.env.PGHOST, port: 5432, user: process.env.PGUSER || "admin", password: token, database: process.env.PGDATABASE || "postgres", ssl: { rejectUnauthorized: false } })
await client.connect()
const u = await client.query(`select id from "user" where username = 'qatester456'`)
const userId = u.rows[0].id
const id = "qa-video-project-1"
await client.query(
  `insert into "portfolioProjects" (id, "userId", title, tagline, "coverImage", "coverImageType", tags, gallery, "sortOrder", "createdAt", "updatedAt")
   values ($1, $2, 'Video Cover QA', 'Testing responsive video cover', $3, 'video', '[]', '[]', 0, now(), now())`,
  [id, userId, "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"]
)
console.log("inserted", id, "for user", userId)
await client.end()
