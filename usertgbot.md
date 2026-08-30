# Telegram Bot Integration for Web Banai

## Goal

Let users manage their Web Banai account entirely from Telegram, two ways:

1. **Built-in bot** — the site runs one shared Telegram bot (`@WebBanaiBot`, token in env). A user links their account to it in a few taps (deep link + confirmation code) and immediately gets full command access.
2. **Own bot (BYO)** — a user who wants their own branded bot enters *their* bot token (from `@BotFather`) and a chat ID in Settings. After a one-time confirmation-code check (to prove they own that chat), the site registers a webhook on their bot and it gets the exact same command set as the built-in bot.

Command surface has **full parity with the public `/api/v1` API** (see `backendApi.md`): posts, likes/reposts/bookmarks, follows, notifications, profile, services/portfolio/testimonials, search — plus **full two-way direct messages**, which today only exist in the web app (not yet in `/api/v1`). Every action a Telegram command performs is executed as that linked user and only that user, reusing the exact same `app/actions/*.ts` / `lib/*.ts` logic the web app and public API already use, so behavior never drifts between surfaces.

This file is the living record of progress: after each phase ships, its checklist items get checked off below so re-reading it later shows exactly what's done and what's left.

## Decisions (confirmed with user)

- **Command scope**: full parity with the public API's authenticated + public surface (not a trimmed MVP subset).
- **Ownership verification**: before a link (built-in *or* BYO) becomes active, a one-time confirmation code is sent to the target chat via Telegram; the user must enter that code back on the site. Prevents a mistyped chat ID (e.g. a group instead of a DM) from getting account access.
- **Direct messages**: full two-way relay — a user can read incoming DMs and reply to them from Telegram, not just get a "you have a new DM, go check the site" ping.
- **Built-in bot token**: not yet created — treated as a setup step. This plan documents exactly which env vars are needed (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_TOKEN_ENCRYPTION_KEY`) and how to obtain them from `@BotFather`; they get filled in via `SystemAction`/project env vars before Phase 1 can go live end-to-end.

## Architecture

### 1. Data model — new `telegramLinks` table

Added to `lib/db/schema.ts`, following the existing no-FK / plain-text-column / JSON-as-TEXT convention already used throughout the file:

```ts
export const telegramLinks = pgTable("telegramLinks", {
  id: text("id").primaryKey(),
  userId: text("userId").notNull().unique(), // one active link per site account
  // "builtin" | "custom" — which bot serves this link.
  kind: text("kind").notNull(),
  // The Telegram chat to message. Null until the user has actually
  // sent /start (builtin) or the confirmation code has been issued
  // (custom), since we don't know their chat id before that.
  chatId: text("chatId"),
  // AES-256-GCM ciphertext of the user's own bot token, encrypted with
  // TELEGRAM_TOKEN_ENCRYPTION_KEY. Null for "builtin" links, which use
  // the shared TELEGRAM_BOT_TOKEN env var instead. Never stored or
  // logged in plaintext.
  botTokenEncrypted: text("botTokenEncrypted"),
  // Cosmetic only (e.g. "@MyOwnBot"), shown in the settings UI. Null
  // for "builtin".
  botUsername: text("botUsername"),
  // Random per-link path segment used as this bot's webhook URL
  // (/api/telegram/webhook/custom/[webhookSecret]) AND passed as
  // Telegram's `secret_token` on setWebhook, so an inbound request is
  // only trusted if both the URL segment and the header match this
  // row. Null for "builtin", which uses one fixed route + the shared
  // TELEGRAM_WEBHOOK_SECRET env var instead of a per-row secret.
  webhookSecret: text("webhookSecret").unique(),
  // 6-digit one-time code + expiry for the ownership-verification step.
  // Cleared once verifiedAt is set.
  verificationCode: text("verificationCode"),
  verificationExpiresAt: timestamp("verificationExpiresAt"),
  // Null until the confirmation code has been entered back on the
  // site. Every bot command is refused for a link with no verifiedAt.
  verifiedAt: timestamp("verifiedAt"),
  // Tracks which conversation a plain-text (non-command) message from
  // this chat should be sent into, so a user can just type a reply
  // after getting a DM notification instead of needing a /reply
  // command every time. Cleared when the user switches threads via
  // /dm <username> or /inbox <n>.
  activeConversationId: text("activeConversationId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})
```

Matching `CREATE TABLE IF NOT EXISTS` + indexes (`userId` unique, `chatId`, `webhookSecret` unique) added to `scripts/bootstrap-schema.mjs` and run against the live Aurora DSQL cluster — same process `backendApi.md` used for `apiKeys`.

### 2. `lib/telegram/crypto.ts` — bot token encryption

- `encryptBotToken(raw)` / `decryptBotToken(ciphertext)` using Node's built-in `crypto` (AES-256-GCM), keyed by `TELEGRAM_TOKEN_ENCRYPTION_KEY`. Same reasoning as `lib/api-keys.ts` hashing API keys — a BYO bot token is as sensitive as a password (whoever holds it can message on behalf of that bot), so it is never stored or logged in plaintext, and only decrypted momentarily, in-memory, right before an outgoing Telegram API call.

### 3. `lib/telegram/client.ts` — thin Telegram Bot API wrapper

- `sendMessage(botToken, chatId, text, opts)`, `answerCallbackQuery(...)`, `setWebhook(botToken, url, secretToken)`, `deleteWebhook(botToken)`, `getMe(botToken)` (used to validate a BYO token and fetch `botUsername` before saving it).
- All calls go straight to `https://api.telegram.org/bot<token>/<method>` via `fetch` — no SDK dependency needed for this surface.
- `resolveOutgoingToken(link)` — returns `TELEGRAM_BOT_TOKEN` for `kind === "builtin"`, or `decryptBotToken(link.botTokenEncrypted)` for `kind === "custom"`. Every send goes through this so the two bot kinds are otherwise indistinguishable to the rest of the code.

### 4. `lib/telegram/links.ts` — link lifecycle helpers (mirrors `lib/api-keys.ts`'s shape)

- `getLinkForUser(userId)` / `getLinkByChatId(chatId)` (builtin lookups key off `chatId` since the shared bot's webhook doesn't know the userId up front) / `getLinkByWebhookSecret(secret)` (custom lookups key off the URL's secret segment).
- `startBuiltinLink(userId)` → generates a fresh `id`, upserts a `kind: "builtin"` row with no `chatId` yet, returns the `t.me/<TELEGRAM_BOT_USERNAME>?start=<id>` deep link the settings page renders as a button/QR code.
- `completeBuiltinLink(startPayload, chatId)` → called from the builtin webhook when `/start <id>` arrives; looks up the row by `id`, sets `chatId`, generates + sends the 6-digit `verificationCode` (expires in 10 min) to that chat, and tells the user to go confirm it on the site.
- `startCustomLink(userId, rawBotToken, chatId)` → calls `getMe` to validate the token and fetch `botUsername`, encrypts the token, generates a random `webhookSecret`, upserts a `kind: "custom"` row, registers the webhook (`setWebhook` with `secret_token: webhookSecret`), then sends the verification code to `chatId` using that same token.
- `confirmVerificationCode(userId, code)` → scoped to the caller's own row; checks code + expiry, sets `verifiedAt`, clears the code. This is the single choke point that turns a link "live" — no command handler runs for an unverified link.
- `unlink(userId)` → scoped to `userId`; for `kind === "custom"` calls `deleteWebhook` first, then deletes the row (or just nulls the sensitive fields — deleting is simpler and avoids stale-token cleanup bugs).

### 5. Webhook routes — `app/api/telegram/webhook/...`

Two routes, sharing one command dispatcher (Section 6) so behavior is identical regardless of which bot the update came from:

- `POST /api/telegram/webhook/builtin` — validates the `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` (rejects otherwise), then resolves the update's `chat.id` via `getLinkByChatId`. If no link row exists yet for that chat and the message is `/start <id>`, routes to `completeBuiltinLink` instead of the command dispatcher.
- `POST /api/telegram/webhook/custom/[secret]` — validates the header against *that row's* `webhookSecret` (must match both the URL segment and the header — defense in depth against a leaked URL alone), resolves the link via `getLinkByWebhookSecret`, then routes to the command dispatcher.
- Both routes always return `200` immediately (Telegram retries aggressively on non-200s) even if the dispatched command failed — errors are reported back to the user as a chat message, not via HTTP status.
- Registration: after `setWebhook`, Telegram's own retry/dedup on `update_id` is relied on as-is; no separate idempotency table for v1 (documented gap, see Notes).

### 6. `lib/telegram/commands.ts` — the command dispatcher (full API parity)

One `handleUpdate(link, update)` entry point, shared by both webhook routes. Parses `update.message.text` (or `callback_query.data` for inline-button taps) and routes by prefix. Every handler:
- Refuses if `link.verifiedAt` is null (should be unreachable given the routes above, but checked again here as a hard guarantee).
- Calls the *same* `app/actions/*.ts` function the web app's UI calls (e.g. `/post <text>` → `app/actions/posts.ts`'s `createPost({ userId: link.userId, content })`), never a re-implementation — identical to how `backendApi.md`'s `/api/v1` routes reuse those actions. This is the core guarantee that "manage the site entirely via Telegram" behaves exactly like using the site.
- Replies via `sendMessage(resolveOutgoingToken(link), link.chatId, ...)`.

Command groups (mirrors `/api/v1` 1:1, plus DMs which are new to *every* surface, not just Telegram):

| Group | Commands |
|---|---|
| Link lifecycle | `/start`, `/verify <code>`, `/unlink`, `/whoami` |
| Profile | `/me`, `/profile <username>`, `/bio <text>` |
| Posts | `/post <text>`, `/delete <postId>`, `/feed [page]`, `/view <postId>` |
| Engagement | `/like <postId>`, `/unlike <postId>`, `/repost <postId>`, `/unrepost <postId>`, `/bookmark <postId>`, `/unbookmark <postId>`, `/bookmarks [page]` |
| Social graph | `/follow <username>`, `/unfollow <username>`, `/followers <username>`, `/following <username>` |
| Notifications | `/notifications [page]` |
| Search | `/search <query>` |
| Services / Portfolio / Testimonials | `/services [username]`, `/portfolio [username]`, `/testimonials [username]`, `/service <id>`, `/project <id>`, `/testimonial <id>`, `/delete-service <id>`, `/delete-project <id>`, `/delete-testimonial <id>` |
| Direct messages (new — full two-way) | `/inbox [page]`, `/dm <username> <message>`, plain-text reply (routes into `link.activeConversationId`), inline "Reply" button on each incoming DM notification |
| Meta | `/help` |

**Scope note on create/edit for services/portfolio/testimonials**: those records carry rich-text HTML (Tiptap output) and image/video galleries — content that has no sane plain-text chat representation. Per the "full parity" decision this is still full parity with the *API's data operations* (list, view, delete are exactly as capable as `/api/v1`), but *create/update* for these three resource types replies with a deep link back to the relevant `/settings` or profile edit page rather than accepting raw HTML over chat. This is called out explicitly rather than silently missing, matching the style of the "out of scope" callouts in `backendApi.md`.

### 7. Direct messages — two-way relay (new capability, not just a Telegram feature)

`lib/messages.ts` already has `getOrCreateConversation`, message insert, and unread tracking for the web app. This phase adds:

- `notifyNewMessage(message)` — called at the end of the existing send-message action (`app/actions/messages.ts`) right after a message is persisted. If the *recipient* has a verified `telegramLinks` row, sends a Telegram message: `"💬 <senderName>: <content>"` with an inline "Reply" button (`callback_query.data = "reply:<conversationId>"`), and sets that recipient's `activeConversationId` to this conversation so a plain-text follow-up routes correctly without them tapping anything.
- Inbound side: a plain-text message from a linked chat that is **not** a recognized `/command` is treated as a DM reply. If `activeConversationId` is set, it's sent into that conversation via the same `sendMessageAction`-backing logic in `app/actions/messages.ts`; the bot confirms with a ✅ reaction/short reply. If nothing is active, the bot replies asking the user to pick a thread with `/inbox` or `/dm <username> ...` first.
- `/inbox [page]` lists open conversations (reusing `getConversationsForUser` from `lib/messages.ts`) with unread counts; tapping a numbered reply or an inline button sets `activeConversationId` and shows the last few messages of that thread.
- Outbound send (`/dm <username> <message>`) resolves `username` → `userId`, calls `getOrCreateConversation` + the existing send logic, exactly like the web composer does.

### 8. Settings UI — `app/actions/telegram.ts` + `/settings/telegram`

New tab, same self-serve pattern as `/settings/developer` (linked from a new "Telegram" card on `/settings/page.tsx`, next to the existing "Developer" card):

- **Not linked**: two options side by side —
  - "Use the Web Banai bot" → button that requests `startBuiltinLink` and renders the resulting `t.me/...?start=...` deep link (as a link + QR code) plus a code-entry field that appears once the site detects (via polling or the confirm action) that a chat id has been captured.
  - "Connect your own bot" → form for bot token (password-style input, never shown again after save) + chat ID, submits to `startCustomLink`, then shows the same code-entry field.
- **Pending verification**: shows "we sent a code to your chat, enter it here" input → calls `confirmVerificationCode`.
- **Linked**: shows bot kind (built-in vs. `@botUsername`), masked chat id, "Send test message" button, link to `/telegram-commands` docs, and an "Unlink" button with a confirmation dialog (calls `unlink`).
- All of this is authenticated the normal Better Auth session way, same as `/settings/developer` — it is not part of the public `/api/v1` surface.

### 9. Commands reference page — `/telegram-commands`

Static docs page (same spirit as `backendApi.md`'s `/developers` page) listing every command from the Section 6 table with a one-line description and example, plus the two linking flows explained step by step. Helps a user discover the full command set without digging through Telegram's own `/help` reply.

## Implementation phases

- [x] **Phase 0 — Bot & env setup**: created `@WebBanaiWaterMarkBot` via `@BotFather`; `TELEGRAM_BOT_TOKEN` + `TELEGRAM_BOT_USERNAME` (bare username, no `@`) set as project env vars; `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_TOKEN_ENCRYPTION_KEY` generated (32-byte random hex) and set; builtin webhook registered against the production deployment URL (`setWebhook` → `/api/telegram/webhook/builtin`, `secret_token: TELEGRAM_WEBHOOK_SECRET`) and confirmed via `getWebhookInfo` (no `last_error_message`, `pending_update_count: 0`). Along the way, fixed a shared bug: `process.env.V0_RUNTIME_URL` can arrive with stray wrapping quote characters in this preview environment, which crashed `new URL(...)` in three separate places (`app/layout.tsx` metadataBase, `lib/auth.ts` Better Auth `baseURL`, `lib/telegram/links.ts` webhook URL resolution). Consolidated all three into one sanitizing `getSiteUrl()` helper in `lib/env.ts` (strips wrapping quotes, validates with `new URL`, falls back safely) — `app/developers/page.tsx` and `lib/telegram/commands.ts` also switched to import it instead of duplicating the resolution logic.
- [x] **Phase 1 — Data & crypto foundation**: `telegramLinks` table added to `lib/db/schema.ts` and `scripts/bootstrap-schema.mjs`, migration run against the live Aurora DSQL cluster; `lib/telegram/crypto.ts` (AES-256-GCM token encryption, verification code + webhook secret generators); `lib/telegram/client.ts` (thin fetch-based Telegram Bot API wrapper + `resolveOutgoingToken`).
- [x] **Phase 2 — Link lifecycle**: `lib/telegram/links.ts` — `startBuiltinLink`, `completeBuiltinLink`, `startCustomLink`, `confirmVerificationCode`, `unlink`, `sendToLink`, `setActiveConversation`, plus lookups by userId/chatId/webhookSecret.
- [x] **Phase 3 — Webhook routes**: `app/api/telegram/webhook/builtin/route.ts` and `app/api/telegram/webhook/custom/[secret]/route.ts`, both secret-token gated, both always returning 200, `/start` + verification-code handling wired in.
- [x] **Phase 4 — Command dispatcher (full parity)**: `lib/telegram/commands.ts` — every command from the Section 6 table implemented (link lifecycle, profile, posts, engagement, social graph, notifications, search, list/view/delete for services/portfolio/testimonials), each one calling the exact same `app/actions/*.ts` / `lib/*.ts` functions as the web app and `/api/v1`. This required adding `*ForUser(userId, ...)` variants to `app/actions/messages.ts` (`startConversationForUser`, `sendMessageForUser`) — the other actions already had this shape from `backendApi.md`'s work.
- [x] **Phase 5 — Two-way direct messages**: `lib/telegram/notify.ts`'s `notifyNewMessage` hooked into `sendMessageForUser` in `app/actions/messages.ts`; `/inbox`, `/dm <username> <message>`, plain-text reply routing via `activeConversationId`, inline "Reply" button (`callback_query.data = "reply:<conversationId>"`) handled in `handleCallback`.
- [x] **Phase 6 — Settings UI**: `app/actions/telegram.ts`; `/settings/telegram` page + `components/telegram-link-manager.tsx` (tabs for built-in vs. BYO, code entry, linked state with test-message + unlink); new "Telegram" card added to `/settings/page.tsx`. Verified live in the browser — both tabs render correctly, and the built-in flow's missing-env-var error surfaces as a clean inline message.
- [x] **Phase 7 — Commands reference page**: `/telegram-commands` static docs page + `lib/telegram-commands-data.ts`, linked from both `/settings/telegram` and its own "Connect Telegram" CTA. Verified live in the browser (all command groups render, sticky `DocsNav` tab bar works).
- [ ] **Phase 8 — Verification**: manual pass, in progress.
  - [x] `tsc --noEmit` passes clean across the whole project.
  - [x] `/settings/telegram` and `/telegram-commands` render and behave correctly in the browser for an authenticated test account.
  - [x] Builtin bot linked end-to-end with a real Telegram account: deep link (`t.me/WebBanaiWaterMarkBot?start=<id>`) → `/start` delivered to the webhook → 6-digit code sent to the real chat → code entered on `/settings/telegram` → link shows "Connected" with masked chat id.
  - [x] "Send test message" button on `/settings/telegram` confirmed delivering a real Telegram DM to the linked chat.
  - [ ] Run one command from each group in the Section 6 table (link lifecycle beyond `/start`, profile, posts, engagement, social graph, notifications, search, services/portfolio/testimonials).
  - [ ] Link a second test account to a real BYO bot token and confirm its webhook only accepts requests with the matching secret.
  - [ ] Send a DM from the web app and confirm a Telegram push arrives; reply from Telegram and confirm it lands back in the web conversation.
  - [ ] Unlink both (builtin + BYO) and confirm the webhooks are deleted and commands are refused afterward.

## Notes / constraints carried over from the codebase

- Aurora DSQL has no FK constraints or JSON/array column types — `telegramLinks` follows the existing plain-text-column + app-level-integrity convention already used throughout `lib/db/schema.ts` (same as `apiKeys`, `services`, etc.).
- No ORM migration tool exists — `scripts/bootstrap-schema.mjs` remains the single source of truth for DDL; it must be updated and re-run for the new table.
- Every command handler reuses `app/actions/*.ts` / `lib/*.ts` logic instead of re-implementing it, so the Telegram surface, the public API, and the web app can never drift apart in validation/ownership rules — same principle `backendApi.md` established for `/api/v1`.
- A BYO bot token is as sensitive as a password for that bot; it is encrypted at rest (`TELEGRAM_TOKEN_ENCRYPTION_KEY`) and only ever decrypted in-memory immediately before an outgoing API call — never logged.
- **Known gap (documented, not silently missing)**: no dedup table for Telegram `update_id`s in v1 — relies on Telegram's own retry semantics (idempotent command handlers where possible, e.g. like/follow are naturally idempotent; `/post` is not, so a rare duplicate network retry could double-post). Revisit if this proves to be a real-world problem.
- **Known gap**: no rate limiting on bot commands, matching the same documented gap on the public API in `backendApi.md`.
