// One-off bootstrap: this Aurora instance is brand new in this
// environment (fresh account/session) and has zero tables. This
// recreates the full schema described by lib/db/schema.ts, including
// the unique constraints application code relies on for
// onConflictDoNothing() (follows, likes, bookmarks, reposts, and
// Better Auth's account issuer+accountId pair). Safe to re-run: every
// statement is IF NOT EXISTS / idempotent.
import { Signer } from "@aws-sdk/rds-signer"
import { awsCredentialsProvider } from "@vercel/functions/oidc"
import { Pool } from "pg"

const signer = new Signer({
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN,
    clientConfig: { region: process.env.AWS_REGION },
  }),
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST,
  username: process.env.PGUSER || "postgres",
  port: 5432,
})

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE || "postgres",
  port: 5432,
  user: process.env.PGUSER || "postgres",
  password: () => signer.getAuthToken(),
  ssl: { rejectUnauthorized: false },
  max: 2,
})

const statements = [
  // Enables trigram-based indexes so ILIKE '%term%' partial-match
  // search on user name/username and post content can use a GIN index
  // instead of a full sequential scan as either table grows.
  `create extension if not exists pg_trgm`,

  // Better Auth core tables
  `create table if not exists "user" (
    id text primary key,
    name text not null,
    email text not null unique,
    "emailVerified" boolean not null default false,
    image text,
    username text unique,
    bio text,
    "bannerImage" text,
    website text,
    location text,
    "createdAt" timestamp not null default now(),
    "updatedAt" timestamp not null default now()
  )`,
  `create table if not exists "session" (
    id text primary key,
    "expiresAt" timestamp not null,
    token text not null unique,
    "createdAt" timestamp not null default now(),
    "updatedAt" timestamp not null default now(),
    "ipAddress" text,
    "userAgent" text,
    "userId" text not null references "user"(id) on delete cascade
  )`,
  `create table if not exists "account" (
    id text primary key,
    "accountId" text not null,
    "providerId" text not null,
    issuer text not null,
    "userId" text not null references "user"(id) on delete cascade,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp,
    "refreshTokenExpiresAt" timestamp,
    scope text,
    password text,
    "createdAt" timestamp not null default now(),
    "updatedAt" timestamp not null default now()
  )`,
  `create unique index if not exists account_issuer_accountId_uidx on "account" (issuer, "accountId")`,
  `create index if not exists user_name_trgm_idx on "user" using gin (name gin_trgm_ops)`,
  `create index if not exists user_username_trgm_idx on "user" using gin (username gin_trgm_ops)`,
  `create table if not exists "verification" (
    id text primary key,
    identifier text not null,
    value text not null,
    "expiresAt" timestamp not null,
    "createdAt" timestamp default now(),
    "updatedAt" timestamp default now()
  )`,

  // App tables
  `create table if not exists "posts" (
    id text primary key,
    "userId" text not null,
    content text not null,
    media jsonb default '[]',
    "replyToId" text,
    "repostOfId" text,
    "quoteOfId" text,
    "isReply" boolean not null default false,
    "isRepost" boolean not null default false,
    "likeCount" integer not null default 0,
    "replyCount" integer not null default 0,
    "repostCount" integer not null default 0,
    "createdAt" timestamp not null default now()
  )`,
  `create index if not exists posts_userId_idx on "posts" ("userId")`,
  `create index if not exists posts_replyToId_idx on "posts" ("replyToId")`,
  `create index if not exists posts_createdAt_idx on "posts" ("createdAt")`,
  `create index if not exists posts_content_trgm_idx on "posts" using gin (content gin_trgm_ops)`,

  `create table if not exists "follows" (
    id text primary key,
    "followerId" text not null,
    "followingId" text not null,
    "createdAt" timestamp not null default now()
  )`,
  `create unique index if not exists follows_follower_following_uidx on "follows" ("followerId", "followingId")`,
  `create index if not exists follows_followingId_idx on "follows" ("followingId")`,

  `create table if not exists "likes" (
    id text primary key,
    "userId" text not null,
    "postId" text not null,
    "createdAt" timestamp not null default now()
  )`,
  `create unique index if not exists likes_user_post_uidx on "likes" ("userId", "postId")`,
  `create index if not exists likes_postId_idx on "likes" ("postId")`,

  `create table if not exists "bookmarks" (
    id text primary key,
    "userId" text not null,
    "postId" text not null,
    "createdAt" timestamp not null default now()
  )`,
  `create unique index if not exists bookmarks_user_post_uidx on "bookmarks" ("userId", "postId")`,

  `create table if not exists "reposts" (
    id text primary key,
    "userId" text not null,
    "postId" text not null,
    "createdAt" timestamp not null default now()
  )`,
  `create unique index if not exists reposts_user_post_uidx on "reposts" ("userId", "postId")`,
  `create index if not exists reposts_postId_idx on "reposts" ("postId")`,

  `create table if not exists "notifications" (
    id text primary key,
    "userId" text not null,
    "actorId" text not null,
    type text not null,
    "postId" text,
    "isRead" boolean not null default false,
    "createdAt" timestamp not null default now()
  )`,
  `create index if not exists notifications_userId_createdAt_idx on "notifications" ("userId", "createdAt" desc)`,
  `create index if not exists notifications_userId_isRead_idx on "notifications" ("userId", "isRead")`,

  // "user1Id"/"user2Id" are always stored with the smaller id first
  // (see sortPair in lib/messages.ts), so a single unique index on the
  // pair both prevents duplicate conversations and backs the
  // getOrCreateConversation lookup — no OR-based query needed there.
  `create table if not exists "conversations" (
    id text primary key,
    "user1Id" text not null,
    "user2Id" text not null,
    "lastMessageAt" timestamp not null default now(),
    "createdAt" timestamp not null default now()
  )`,
  `create unique index if not exists conversations_user_pair_uidx on "conversations" ("user1Id", "user2Id")`,
  // Composite indexes (rather than plain single-column ones) so the
  // inbox query's "conversations for this user, newest first" can use
  // the index for both the equality filter and the ORDER BY.
  `create index if not exists conversations_user1Id_lastMessageAt_idx on "conversations" ("user1Id", "lastMessageAt" desc)`,
  `create index if not exists conversations_user2Id_lastMessageAt_idx on "conversations" ("user2Id", "lastMessageAt" desc)`,

  `create table if not exists "messages" (
    id text primary key,
    "conversationId" text not null,
    "senderId" text not null,
    content text not null,
    "isRead" boolean not null default false,
    "createdAt" timestamp not null default now()
  )`,
  `create index if not exists messages_conversationId_createdAt_idx on "messages" ("conversationId", "createdAt")`,
  // Backs the inbox's per-conversation unread count (messages from the
  // other participant that this viewer hasn't read yet).
  `create index if not exists messages_conversationId_isRead_idx on "messages" ("conversationId", "isRead")`,

  // Moderation MVP: blocks + reports
  `create table if not exists "blocks" (
    id text primary key,
    "blockerId" text not null,
    "blockedId" text not null,
    "createdAt" timestamp not null default now()
  )`,
  `create unique index if not exists blocks_blocker_blocked_uidx on "blocks" ("blockerId", "blockedId")`,
  `create index if not exists blocks_blockedId_idx on "blocks" ("blockedId")`,

  `create table if not exists "reports" (
    id text primary key,
    "reporterId" text not null,
    "targetType" text not null,
    "targetId" text not null,
    reason text not null,
    "createdAt" timestamp not null default now()
  )`,
  // Prevents the same user from spamming duplicate reports of the same
  // target — mirrors the likes/bookmarks/reposts onConflictDoNothing pattern.
  `create unique index if not exists reports_reporter_target_uidx on "reports" ("reporterId", "targetType", "targetId")`,
]

const client = await pool.connect()
try {
  for (const statement of statements) {
    await client.query(statement)
  }
  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  )
  console.log(
    "Bootstrap complete. Tables:",
    tables.rows.map((r) => r.table_name),
  )
} finally {
  client.release()
  await pool.end()
}
