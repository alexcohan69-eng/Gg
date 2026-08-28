import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core"

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
  // Long-form rich-text "About" section shown on the About page.
  // Separate from `bio` (the short one-line intro used in the header
  // and card previews) — this is sanitized HTML from the same
  // rich-text editor used by the post composer.
  about: text("about"),
  // Career overview fields shown on the About page. All optional —
  // profiles that haven't filled these in fall back to empty states.
  yearsExperience: integer("yearsExperience"),
  totalClients: integer("totalClients"),
  totalProjects: integer("totalProjects"),
  // Aurora DSQL doesn't support JSON/JSONB or array column types, so
  // these are stored as JSON-encoded TEXT and parsed/stringified in
  // application code (see lib/career.ts and app/actions/career.ts)
  // instead of relying on the driver's jsonb (de)serialization.
  skills: text("skills"),
  workflowSteps: text("workflowSteps"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export type WorkflowStep = {
  title: string
  description: string
}

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  // Plain text column, no FK — Aurora DSQL doesn't support foreign key
  // constraints. Referential integrity (and cascade delete) is handled
  // in application code instead.
  userId: text("userId").notNull(),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  // Required by Better Auth 1.7+. Forms a unique compound index with
  // accountId (see account_issuer_accountId_uidx) that identifies a
  // credential/provider account.
  issuer: text("issuer").notNull(),
  // Plain text column, no FK — Aurora DSQL doesn't support foreign key
  // constraints. Referential integrity (and cascade delete) is handled
  // in application code instead.
  userId: text("userId").notNull(),
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
  // JSON-encoded TEXT, not jsonb — Aurora DSQL has no JSON/JSONB
  // column type. Parsed/stringified in application code (see
  // lib/posts.ts and app/actions/posts.ts).
  media: text("media"),
  replyToId: text("replyToId"),
  repostOfId: text("repostOfId"),
  quoteOfId: text("quoteOfId"),
  // At most one of these is ever set — the post is a native post that
  // also embeds a preview card linking back to one of the author's own
  // services/portfolioProjects/testimonials rows. Plain text columns,
  // no FK (Aurora DSQL has no foreign key constraints); referential
  // integrity (clearing the link if the linked row is deleted) is
  // enforced in application code — see the delete actions in
  // app/actions/services.ts / portfolio.ts / testimonials.ts.
  attachedServiceId: text("attachedServiceId"),
  attachedProjectId: text("attachedProjectId"),
  attachedTestimonialId: text("attachedTestimonialId"),
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

export const reposts = pgTable("reposts", {
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

export const blocks = pgTable("blocks", {
  id: text("id").primaryKey(),
  blockerId: text("blockerId").notNull(),
  blockedId: text("blockedId").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

/**
 * Past roles shown in the About page's experience timeline.
 * `sortOrder` (lower = earlier in the list, typically most recent
 * first) lets the owner reorder entries without relying on dates,
 * since `startDate`/`endDate` are free-text ("Jan 2022") rather than
 * real date columns.
 */
export const workExperience = pgTable("workExperience", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  role: text("role").notNull(),
  company: text("company").notNull(),
  startDate: text("startDate").notNull(),
  endDate: text("endDate"),
  isCurrent: boolean("isCurrent").notNull().default(false),
  description: text("description"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

/**
 * Contra-style portfolio case studies shown on the profile's Work tab.
 * `sortOrder` (lower = earlier) lets the owner manually reorder
 * projects, same pattern as `workExperience`. `tags` and `gallery` are
 * JSON-encoded TEXT since Aurora DSQL has no array/JSON column types
 * (see lib/portfolio.ts for the parse/stringify helpers).
 */
export const portfolioProjects = pgTable("portfolioProjects", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  coverImage: text("coverImage"),
  // "image" | "gif" | "video" (see lib/media.ts MediaType). Null for
  // rows written before video/GIF covers existed — treated as "image"
  // by the app layer (see lib/portfolio.ts) since every legacy cover
  // is one.
  coverImageType: text("coverImageType"),
  client: text("client"),
  externalUrl: text("externalUrl"),
  tags: text("tags"),
  description: text("description"),
  // JSON-encoded TEXT array of `{ url, type }` MediaAttachment objects
  // (Aurora DSQL has no JSON/array column types) — see lib/portfolio.ts.
  // Older rows may still be a plain string[] of URLs; parsed
  // defensively for backward compatibility.
  gallery: text("gallery"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

/**
 * Fiverr-gig-style listings shown on the profile's Services tab — what
 * the user offers, a starting price, and a delivery estimate. Same
 * shape/conventions as `portfolioProjects` (JSON-encoded TEXT for
 * `tags`/`gallery` since Aurora DSQL has no array/JSON column types,
 * `sortOrder` for manual reordering) — see lib/services.ts for the
 * parse helpers.
 */
export const services = pgTable("services", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  tagline: text("tagline").notNull(),
  coverImage: text("coverImage"),
  // "image" | "gif" | "video" (see lib/media.ts MediaType).
  coverImageType: text("coverImageType"),
  // Starting price, stored in whole-dollar units (no cents) — this is
  // a "starting at $X" listing price, not a checkout amount.
  startingPrice: integer("startingPrice").notNull(),
  deliveryDays: integer("deliveryDays").notNull(),
  category: text("category"),
  tags: text("tags"),
  description: text("description"),
  // JSON-encoded TEXT array of `{ url, type }` MediaAttachment objects,
  // same convention as portfolioProjects.gallery.
  gallery: text("gallery"),
  // JSON-encoded TEXT array of `ServicePackage` tiers (name, price,
  // deliveryDays, description, features) — Fiverr-style Basic/
  // Standard/Premium pricing packages. Optional: a listing with no
  // packages falls back to the flat startingPrice/deliveryDays.
  // Added after the table already existed in prior environments.
  packages: text("packages"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

/**
 * Client testimonials/reviews shown on the profile's Testimonials tab —
 * a short quote attributed to a client, plus their name/title and an
 * optional 1-5 star rating. Same self-managed, owner-curated shape as
 * `portfolioProjects`/`services` (`sortOrder` for manual reordering),
 * but without a gallery or pricing since a testimonial is just a quote.
 * See lib/testimonials.ts for the read helpers.
 */
export const testimonials = pgTable("testimonials", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  // Optional links to one of the owner's own services/portfolioProjects
  // rows — at most one of the two is ever set (a testimonial is about
  // either a service or a case study, not both). Plain text columns,
  // no FK (Aurora DSQL has no foreign key constraints); referential
  // integrity (and clearing the link if the linked row is deleted) is
  // enforced in application code — see app/actions/testimonials.ts and
  // the delete actions in app/actions/services.ts / portfolio.ts. Used
  // to surface a "Client reviews" section on the service/project detail
  // pages (see lib/testimonials.ts's getTestimonialsForService/Project).
  serviceId: text("serviceId"),
  projectId: text("projectId"),
  authorName: text("authorName").notNull(),
  // e.g. "Founder, Acme Co." — optional, shown under the author name.
  authorTitle: text("authorTitle"),
  authorAvatar: text("authorAvatar"),
  // 1-5, optional — a testimonial can omit a star rating.
  rating: integer("rating"),
  // Sanitized rich-text HTML from the same Tiptap editor used by the
  // service/portfolio descriptions — supports bold/italic/lists/quote/
  // links and inline images, not just a plain quote string.
  content: text("content").notNull(),
  // Optional label for what the testimonial is about, e.g. "Brand redesign".
  projectTitle: text("projectTitle"),
  // JSON-encoded TEXT array of `{ url, type }` MediaAttachment objects,
  // same convention as portfolioProjects.gallery/services.gallery —
  // optional proof photos/videos (e.g. a screenshot of the client's
  // message, before/after shots) attached to the quote. Added after
  // the table already existed in prior environments.
  media: text("media"),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

/**
 * Personal API keys for the public REST API (`/api/v1/*`). Only a
 * SHA-256 hash of the secret is stored — the raw key is shown to the
 * user once, at creation time, and never persisted or displayed
 * again. `keyPrefix` (first 8 chars of the raw key) is stored
 * separately so the settings UI can show "pk_live_ab12..." without
 * ever re-reading the full secret. Plain `userId` text column, no FK
 * (Aurora DSQL has none) — same convention as every other app table.
 */
export const apiKeys = pgTable("apiKeys", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  keyHash: text("keyHash").notNull().unique(),
  keyPrefix: text("keyPrefix").notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

/**
 * Moderation reports for the report-post / report-user MVP. `reason`
 * is a small closed set of strings (see lib/moderation.ts) rather than
 * its own enum table. `status` + `reviewedBy`/`reviewedAt` back the
 * admin review surface (lib/reports.ts, app/(app)/admin) — reports
 * start "open" and move to "resolved" or "dismissed" once a moderator
 * acts on them.
 */
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporterId").notNull(),
  targetType: text("targetType").notNull(), // "post" | "user"
  targetId: text("targetId").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // "open" | "resolved" | "dismissed"
  reviewedBy: text("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
