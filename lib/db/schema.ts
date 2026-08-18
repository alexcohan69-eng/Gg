import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
} from "drizzle-orm/pg-core"

/**
 * Better Auth core tables. Column names are camelCase to match Better
 * Auth's defaults exactly — do not rename them. These were created via
 * the Neon MCP and mirrored here for type-safe queries.
 */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  username: text("username").unique(),
  bio: text("bio"),
  bannerImage: text("bannerImage"),
  website: text("website"),
  location: text("location"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  // Required by Better Auth 1.7+. Forms a unique compound index with
  // accountId (see account_issuer_accountId_uidx) that identifies a
  // credential/provider account.
  issuer: text("issuer").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

/**
 * App tables. These use a plain `userId` text column (no FK constraint)
 * per the Neon skill — every query scopes by userId in application code
 * instead of relying on Postgres RLS.
 */

export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  content: text("content").notNull(),
  imageUrls: jsonb("imageUrls").$type<string[]>().default([]),
  replyToId: text("replyToId"),
  repostOfId: text("repostOfId"),
  quoteOfId: text("quoteOfId"),
  isReply: boolean("isReply").notNull().default(false),
  isRepost: boolean("isRepost").notNull().default(false),
  likeCount: integer("likeCount").notNull().default(0),
  replyCount: integer("replyCount").notNull().default(0),
  repostCount: integer("repostCount").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const follows = pgTable("follows", {
  id: text("id").primaryKey(),
  followerId: text("followerId").notNull(),
  followingId: text("followingId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const likes = pgTable("likes", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  postId: text("postId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const bookmarks = pgTable("bookmarks", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  postId: text("postId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  actorId: text("actorId").notNull(),
  type: text("type").notNull(), // "follow" | "like" | "reply" | "repost"
  postId: text("postId"),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const conversations = pgTable("conversations", {
  id: text("id").primaryKey(),
  user1Id: text("user1Id").notNull(),
  user2Id: text("user2Id").notNull(),
  lastMessageAt: timestamp("lastMessageAt").notNull().defaultNow(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversationId").notNull(),
  senderId: text("senderId").notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
