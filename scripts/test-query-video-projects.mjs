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
const res = await client.query(`select id, "userId", title, "coverImage", "coverImageType" from "portfolioProjects"`)
console.log(JSON.stringify(res.rows, null, 2))
await client.end()
