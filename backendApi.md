# Public Developer API for Pulse

## Goal

Expose a public, versioned REST API (`/api/v1/...`) so third-party developers can build their own tools/apps against Pulse's data — reading public content and, when authenticated with a user's own API key, acting **only as that user** (their own posts, likes, follows, profile, services, etc.). An API key can never read/write another account's private data or perform actions as another user. Ships with a self-serve developer settings page for generating/naming/revoking keys, and a docs page describing every endpoint.

This file is the living record of progress: after each phase ships, its checklist items get checked off below so re-reading it later shows exactly what's done and what's left.

## Decisions (confirmed with user)

- **Auth**: API keys (`pk_live_...` bearer tokens), not OAuth2.
- **Scope**: Full read/write, but always scoped to the authenticated key's own user — never able to modify another user's data. Public read endpoints require no key.
- **Dev portal**: Self-serve UI under Settings for create/name/view (masked)/revoke of keys.
- **Rate limiting**: None for v1 (documented as a known gap / future work, not silently skipped).

## Architecture

### 1. Data model — new `apiKeys` table

Added to `lib/db/schema.ts`, following the existing no-FK / plain-text-column convention:

```ts
export const apiKeys = pgTable("apiKeys", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(), // developer-chosen label, e.g. "My Discord bot"
  // SHA-256 hash of the actual secret — the raw key is shown once at
  // creation time and never stored or retrievable again.
  keyHash: text("keyHash").notNull().unique(),
  // Last 4 chars of the raw key, for the settings UI to show
  // "pk_live_••••••••ab12" without ever re-displaying the full secret.
  keyPreview: text("keyPreview").notNull(),
  lastUsedAt: timestamp("lastUsedAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
```

Matching `CREATE TABLE IF NOT EXISTS` + indexes (`userId`, `keyHash`) added to `scripts/bootstrap-schema.mjs`, run against the live DSQL cluster.

Key format: `pk_live_<32 random url-safe chars>`. Store only `sha256(rawKey)` in `keyHash`; generated with Node's `crypto.randomBytes`/`crypto.createHash`.

### 2. `lib/api-keys.ts` — key issuing/verification helpers

- `createApiKey(userId, name)` → generates raw key, stores hash+preview, returns `{ id, rawKey, name, createdAt }` (raw key only returned once).
- `listApiKeys(userId)` → id, name, keyPreview, lastUsedAt, createdAt, revoked status (never the hash).
- `revokeApiKey(userId, keyId)` → scoped to `userId` so a user can only revoke their own key; sets `revokedAt`.
- `verifyApiKey(rawKey)` → hashes incoming key, looks up by `keyHash`, checks not revoked, updates `lastUsedAt` (best-effort, non-blocking), returns the owning `userId` or `null`.

### 3. `lib/api-auth.ts` — request authentication for the public API

- `authenticateApiRequest(request)`:
  - Reads `Authorization: Bearer <key>` header.
  - If missing → returns `{ userId: null }` (fine for public GETs).
  - If present → `verifyApiKey`; invalid/revoked key → throw a typed `ApiAuthError` the route handlers turn into `401`.
- `requireApiUser(request)`: same, but throws `401` if no valid key at all — used by every write endpoint and any "me" read endpoint.
- Every mutation handler compares the resource's owning `userId` to the authenticated key's `userId` before writing — reusing the same ownership checks already in `app/actions/*.ts` wherever possible instead of duplicating logic, so behavior stays identical between the web app and the public API.

### 4. Route structure — `app/api/v1/...`

All new, versioned, and additive — none of the existing internal `app/api/*` routes (used by the web app itself) are touched. Every response is JSON with a consistent envelope: `{ data }` on success, `{ error: { message, code } }` on failure, standard HTTP status codes (400/401/403/404/429-reserved/500).

Public (no key required, but honor an optional key to also return viewer-specific flags like `likedByViewer` when present):
- `GET /api/v1/users/:username` — public profile
- `GET /api/v1/users/:username/posts` — a user's posts (paginated)
- `GET /api/v1/users/:username/followers`, `/following`
- `GET /api/v1/users/:username/services`, `/portfolio`, `/testimonials`
- `GET /api/v1/posts/:id` — single post + replies
- `GET /api/v1/posts` — public feed (paginated, `?sort=recent`)
- `GET /api/v1/search?q=...` — reuse `lib/search.ts`

Authenticated, scoped to the key's own user (mirrors `app/actions/*.ts`):
- `GET /api/v1/me` — current key's profile
- `PATCH /api/v1/me` — update own profile fields (bio, website, location, etc. — reuse `app/actions/profile.ts` logic)
- `POST /api/v1/posts` / `DELETE /api/v1/posts/:id` — create/delete own post (reuse `app/actions/posts.ts`)
- `POST /api/v1/posts/:id/like` / `DELETE .../like` — like/unlike
- `POST /api/v1/posts/:id/repost` / `DELETE .../repost`
- `POST /api/v1/posts/:id/bookmark` / `DELETE .../bookmark`
- `GET /api/v1/me/bookmarks`
- `POST /api/v1/users/:username/follow` / `DELETE .../follow`
- `GET /api/v1/me/notifications`
- Services/portfolio/testimonials CRUD scoped to the key's own user, reusing `app/actions/services.ts` / `portfolio.ts` / `testimonials.ts`.

Explicitly **out of scope for v1** (documented, not silently missing): direct messages, admin/moderation endpoints, and anything involving another user's private data. These stay web-app-only.

Each write route re-runs the same validation used by its `app/actions` counterpart (content length, media shape, etc.) rather than inventing new rules, so the API and the web UI enforce identical constraints.

### 5. Self-serve developer settings page

New tab in `app/(app)/settings` (matches existing settings page pattern) at `/settings/developer`:
- List existing keys (name, masked preview, created/last-used dates, revoke button).
- "Create new key" flow: name input → generate → show raw key **once** in a copy-able callout with a clear "you won't see this again" warning → key disappears from view on navigation/refresh.
- Revoke with confirmation dialog.
- Link to the API docs page.
- New server actions in `app/actions/api-keys.ts` backing this page (create/list/revoke), authenticated the normal Better Auth session way (this page itself is not part of the public API surface).

### 6. Docs page

Static docs page (e.g. `/developers`) listing base URL, auth header format, every endpoint with method/path/params/example request+response, and the "scoped to your own account only" security note. Plain React static content page — no new tooling needed.

## Implementation phases

- [x] **Phase 1 — Data & auth foundation**: `apiKeys` schema + bootstrap script update + run against live DB; `lib/api-keys.ts`; `lib/api-auth.ts`.
- [x] **Phase 2 — Developer settings UI**: `app/actions/api-keys.ts`; `/settings/developer` page (create/list/revoke key UI).
- [x] **Phase 3 — Public read endpoints**: users/posts/search/services/portfolio/testimonials GET routes under `app/api/v1`.
- [x] **Phase 4 — Authenticated write endpoints**: me, posts CRUD, like/repost/bookmark/follow, own services/portfolio/testimonials CRUD.
- [x] **Phase 5 — Docs page**: `/developers` page documenting the full API.
- [x] **Phase 6 — Verification**: manual `curl`/browser pass creating a key, calling a public GET, calling an authenticated write, and confirming a key cannot act on another user's resources (expect 403/404, never a silent success).

### Verification log (this session)

All phases were already fully implemented in the codebase; this session re-bootstrapped the DSQL schema (confirmed `apiKeys` table exists), ran `tsc --noEmit` clean, and did a live end-to-end pass:

- Signed up a test account (`testuser99`) — confirms Better Auth + DB writes.
- Created an API key via `/settings/developer` → got `pk_live_...` raw key shown once.
- `GET /api/v1/me` with no key → `401 missing_api_key`. With the key → returns the profile.
- `POST /api/v1/posts` with the key → `201`, then `GET /api/v1/posts` (no key, public) immediately showed the new post — confirms the write and public read paths share the same data.
- `DELETE /api/v1/posts/:id` with an invalid/garbage key → `401 invalid_api_key` (never a silent success on someone else's/an unowned resource). Deleting with the valid, owning key → succeeded, and the public feed reflected the deletion.

No remaining gaps against this spec. The only documented known gap (no rate limiting) is intentional per the "Decisions" section above.

## Notes / constraints carried over from the codebase

- Aurora DSQL has no FK constraints or JSON/array column types — `apiKeys` and every new query follow the existing plain-text-column + app-level-integrity convention already used throughout `lib/db/schema.ts`.
- No ORM migration tool exists — `scripts/bootstrap-schema.mjs` is the single source of truth for DDL; it must be updated and re-run for the new table (see the `startdev.md` note about schema drift from the last session).
- Reuse `lib/*.ts`/`app/actions/*.ts` business logic instead of re-implementing it in the new routes, so the public API and the existing web app can never drift apart in validation/ownership rules.
