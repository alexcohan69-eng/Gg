# Starting This Project Locally

This is a Next.js 16 (App Router) social app called **Web Banai** (formerly "Pulse"), using:

- **Database**: Amazon **Aurora DSQL** (NOT Aurora PostgreSQL — see warning below) via `pg` + Drizzle ORM, authenticated with short-lived IAM tokens (no static DB password).
- **Auth**: Better Auth (email + password).
- **File storage**: Vercel Blob (private) for avatars, banners, and post media.
- **Telegram bot integration**: a built-in shared bot (`@WebBanaiWaterMarkBot`) plus a "bring your own bot" option, letting users manage their account from Telegram. See `usertgbot.md` for the full feature plan and current phase-by-phase status.
- **Package manager**: pnpm (see `pnpm-lock.yaml`).

**If the user just says "read startdev.md and start the project," run the Quick Start below top-to-bottom without stopping to ask questions — every step is designed to be resolved from this file alone.** Only pause and ask the user if a step below explicitly says a human is required (Telegram bot creation), or if a check fails in a way this file doesn't cover.

## Quick Start (do this, in order, every time)

1. **Check integrations & env vars first** — call `GetOrRequestIntegration` with `fetchAll: true`. This project needs **Amazon Aurora DSQL** and **Blob** connected. If either is missing, `GetOrRequestIntegration({ names: ["Amazon Aurora DSQL", "Blob"] })` will surface a one-click connect card — do this before anything else, since nothing works without them.
   - Also check whether `BETTER_AUTH_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_TOKEN_ENCRYPTION_KEY` already exist as project env vars (they persist across sessions once set once — see the full table in step 2 below). **Do not ask the user to re-add env vars that are already listed as available in the environment/system prompt** — only request the ones that are actually missing.
2. **Install dependencies**: `pnpm install` (never `npm install` / `yarn` — see step 2 detail below).
3. **Bootstrap the DB schema** (safe to always re-run, it's idempotent): `node --env-file-if-exists=.env.development.local scripts/bootstrap-schema.mjs`.
4. **If `BETTER_AUTH_SECRET` is missing**, request it via `SystemAction` (`requestEnvironmentVariables`) — it is never provided by an integration.
5. **If any `TELEGRAM_*` var is missing**, follow "Telegram bot setup" (step 5 below) — this is the only step that requires a human in Telegram, everything else in this file is fully agent-driven.
6. **If `TELEGRAM_*` vars already exist**, still re-register the webhook against the current deployment's public URL (step 5.4 below) — the public URL can change between sandbox sessions/deployments, and a stale webhook URL is the most common "bot doesn't reply" cause. Cheap to always do; skip only if `getWebhookInfo` already shows the correct current URL with no errors.
7. **Start the dev server**: `pnpm dev` (or let the environment's own dev server manage this — check if one is already running on port 3000 before starting a second one).
8. **Verify** using step 7 below.

Skipping the schema step, using the wrong signer package, or leaving the Telegram webhook pointed at a stale URL are the most common causes of "it compiles but nothing works" errors.

## 0. Connect the required integrations (v0 environment)

Before installing anything, make sure both integrations below are connected to the project. In v0, call `GetOrRequestIntegration` with `names: ["Amazon Aurora DSQL", "Blob"]` — this checks connection status and, if either is missing, shows the user a one-click connect card. Do not skip this: without both connected, `PGHOST`/`AWS_ROLE_ARN`/`AWS_REGION` (DSQL) and `BLOB_READ_WRITE_TOKEN` (Blob) won't exist and every DB call and file upload will fail.

- **Amazon Aurora DSQL** — the database. Provides `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPORT`, `PGSSLMODE`, `AWS_REGION`, `AWS_ROLE_ARN`, `AWS_RESOURCE_ARN`, `AWS_ACCOUNT_ID`.
- **Vercel Blob** — file storage for avatars, banners, and post media. Provides `BLOB_READ_WRITE_TOKEN`.

If you're outside v0 (e.g. a plain Vercel deployment), add these through the Vercel dashboard integrations page instead, then `vercel env pull`.

## 1. Install dependencies

```bash
pnpm install
```

Do not use `npm install` or `yarn` — the project is locked to pnpm (`pnpm-lock.yaml`, and a `pnpm.overrides` entry in `package.json`).

## 2. Set environment variables

Copy `.env.development.local` from the existing Vercel project/team (via `vercel env pull` or the Vercel dashboard → Project Settings → Environment Variables) into the project root. Required variables:

| Variable | Purpose |
|---|---|
| `PGHOST` | Aurora DSQL cluster endpoint |
| `PGUSER` | DB user (usually `admin`) |
| `PGDATABASE` | DB name |
| `PGPORT` | DB port |
| `PGSSLMODE` | Must be `require` |
| `AWS_REGION` | Region of the DSQL cluster |
| `AWS_ROLE_ARN` | IAM role assumed via Vercel OIDC to sign DB auth tokens |
| `AWS_RESOURCE_ARN` | ARN of the DSQL cluster |
| `AWS_ACCOUNT_ID` | AWS account id |
| `BETTER_AUTH_SECRET` | Random 32+ char secret for session signing — generate with `openssl rand -base64 32` if missing. **Not provided by any integration** — prompt the user for it via `SystemAction` (`requestEnvironmentVariables`) the first time it's missing; once set, it persists across sessions — do not ask again if it's already listed as available. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
| `TELEGRAM_BOT_TOKEN` | Built-in bot's token from `@BotFather` (e.g. `123456789:AA...`). **Not provided by any integration** — see "Telegram bot setup" below. Once set, persists across sessions. |
| `TELEGRAM_BOT_USERNAME` | Built-in bot's username, **bare, no leading `@`** (e.g. `WebBanaiWaterMarkBot`, not `@WebBanaiWaterMarkBot`). Used to build the `t.me/<username>?start=<id>` deep link in `/settings/telegram`. Once set, persists across sessions. |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32+ byte secret (hex/base64, must NOT contain `:`) checked against Telegram's `X-Telegram-Bot-Api-Secret-Token` header on the builtin webhook route. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never reuse `TELEGRAM_BOT_TOKEN`'s value here** — it contains a `:` and is a different secret with a different purpose. Once set, persists across sessions — do NOT regenerate a working one, since that would invalidate the already-registered webhook. |
| `TELEGRAM_TOKEN_ENCRYPTION_KEY` | Random 32+ byte key (hex/base64) used to AES-256-GCM encrypt BYO bot tokens at rest (`lib/telegram/crypto.ts`). Generate the same way as `TELEGRAM_WEBHOOK_SECRET`, as a **separate** random value — do not reuse it or the bot token. Once set, persists across sessions — do NOT regenerate a working one, since that would make any already-linked BYO bot tokens undecryptable. |
| `AI_GATEWAY_API_KEY` | Only needed if AI features are added later |

There is **no static database password**. Auth to the DB works by exchanging Vercel's OIDC token for temporary AWS credentials (`AWS_ROLE_ARN` + `AWS_REGION`), then using those credentials to generate a short-lived DSQL auth token. This requires the app to be running inside a Vercel-connected environment (Vercel Sandbox, Vercel deployment, or a machine with `vercel env pull`'d credentials) — plain local Postgres credentials will not work.

**Important**: once `BETTER_AUTH_SECRET` and the four `TELEGRAM_*` variables are set for this project, they are available in every future session automatically (they show up as already-available env vars in the environment/system prompt, or via `GetOrRequestIntegration({ fetchAll: true })`). Do not re-prompt the user for them or regenerate new random values "just in case" — reusing the existing values is required, since regenerating the webhook secret or encryption key would break the already-registered webhook and any already-linked BYO bot tokens respectively.

## 3. Bootstrap the database schema (safe to always re-run)

The Aurora DSQL cluster starts with zero tables. Run the bootstrap script to create all tables and indexes:

```bash
node --env-file-if-exists=.env.development.local scripts/bootstrap-schema.mjs
```

This is idempotent (every statement is `IF NOT EXISTS`), so run it every time you start the project fresh, not just the very first time — it's a no-op if the schema is already current, and it's the fix if a new table (e.g. `telegramLinks`) was added to `lib/db/schema.ts` after your last bootstrap run. Read the comments at the top of `scripts/bootstrap-schema.mjs` before modifying the schema — Aurora DSQL has real limitations that differ from regular Postgres:

- No JSON/JSONB or array column types (JSON is stored as TEXT and encoded/decoded in app code).
- No foreign key constraints (referential integrity is enforced in application code only).
- No `SERIAL` — all ids are app-generated text (e.g. `crypto.randomUUID()`).
- Indexes must use `CREATE INDEX ASYNC` / `CREATE UNIQUE INDEX ASYNC`, B-tree only.
- No extensions (e.g. `pg_trgm`) — text search uses `ILIKE` sequential scans, not trigram indexes.
- Each DDL statement must run in its own transaction.

If you change `lib/db/schema.ts`, update `scripts/bootstrap-schema.mjs` to match and re-run it — there is no separate migration tool.

**⚠️ Known past drift (already fixed, but re-check if you see similar errors):**
- `posts.attachedServiceId`, `posts.attachedProjectId`, and `posts.attachedTestimonialId` existed in `lib/db/schema.ts` but were missing from `scripts/bootstrap-schema.mjs`'s `posts` table. Sign-up itself succeeded, but the app crashed immediately after with `error: column posts.attachedServiceId does not exist` because the post-signup redirect to `/home` runs `getFeedPosts()`, which selects those columns.
- The `telegramLinks` table was added to `lib/db/schema.ts` and `scripts/bootstrap-schema.mjs` together, but if you ever bootstrap an older checkout of the DB before pulling the Telegram feature's code, `/settings/telegram` will 500 with `relation "telegram_links" does not exist` until you re-run the bootstrap script against the current schema file.

**Whenever you add a column/table to `lib/db/schema.ts`, always add a matching `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `scripts/bootstrap-schema.mjs` (a bare `CREATE TABLE` is a no-op once the table already exists — you need the `ALTER TABLE` for existing tables) and re-run the script — otherwise the schema silently drifts and the first query touching the new column/table crashes at runtime instead of at build time.**

## 4. ⚠️ Critical: DSQL vs Aurora PostgreSQL signer

`lib/db/index.ts` and `scripts/bootstrap-schema.mjs` MUST both use `DsqlSigner` from `@aws-sdk/dsql-signer`. Do **not** use `Signer` from `@aws-sdk/rds-signer` (that package is for Aurora **PostgreSQL**, a different product with a different auth mechanism). Using the wrong signer causes every DB connection to fail silently or with an opaque auth error, even though the code compiles fine. If you ever see connection/auth errors, check this first.

## 5. Telegram bot setup

The four `TELEGRAM_*` env vars persist once set (see step 2) — check whether they already exist before doing anything else in this section. If they're already present, jump straight to step 5.4 (re-register the webhook) since that's the one thing that needs to be re-done whenever the app's public URL changes (e.g. a new sandbox session, a new deployment domain). See `usertgbot.md` for the full feature plan and phase-by-phase status.

1. **Check first**: call `GetOrRequestIntegration` with `fetchAll: true` (or check `.env.development.local` / the environment/system prompt for already-available vars) — if all four `TELEGRAM_*` vars already exist, skip straight to step 5.4.
2. **If missing, create the bot** (requires a human with the Telegram app — cannot be done by the agent): ask the user to open Telegram, message `@BotFather`, send `/newbot`, pick a display name, and pick a `@username` ending in `bot` (must be globally unique). BotFather replies with a token like `123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`. Get that token and the final username back from the user.
3. **Set the four env vars** via `SystemAction` (`requestEnvironmentVariables`) — never ask the user to add them again once set:
   - `TELEGRAM_BOT_TOKEN` = the token from BotFather, verbatim.
   - `TELEGRAM_BOT_USERNAME` = the username **without** the leading `@`.
   - `TELEGRAM_WEBHOOK_SECRET` = generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — a fresh random value, **not** the bot token (the bot token contains `:`, which breaks Telegram's secret-token header).
   - `TELEGRAM_TOKEN_ENCRYPTION_KEY` = generate the same way, as a **separate** random value from the webhook secret.
4. **Register (or re-register) the webhook** against the app's *current* real public URL (the production Vercel deployment, not the local dev/preview domain — Telegram must be able to reach it over the internet, and the local sandbox preview domain returns redirects instead of your app's JSON). Do this every session, even if `TELEGRAM_*` vars already existed, since the public URL can change:
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"https://<your-production-domain>/api/telegram/webhook/builtin\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
   ```
   Confirm with `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"` — expect the `url` field to match the current production domain, no `last_error_message`, and `pending_update_count: 0` (or draining to 0).
5. If the env vars were just added/changed for the first time, redeploy to production so the live deployment actually reads the new values (`vercel env pull` locally is not enough on its own — the deployed serverless functions need to be rebuilt with the new env vars too). Re-registering the webhook URL (step 5.4) does **not** require a redeploy — it's just an API call to Telegram.

## 6. Run the dev server

```bash
pnpm dev
```

The app runs on `http://localhost:3000` by default. Check whether a dev server is already running (e.g. managed by the sandbox environment) before starting a second one on the same port.

## 7. Verify it's working

- Visit `/signup` and create an account — confirms Better Auth + DB writes work.
- Create a post from `/home` — confirms the rich text editor, post storage, and feed queries work.
- Upload an avatar/banner or attach media to a post — confirms `BLOB_READ_WRITE_TOKEN` / Vercel Blob is configured.
- Visit `/settings/telegram`, click to link the built-in bot, open the deep link in Telegram, send `/start`, enter the code it replies with — confirms the Telegram bot integration (including the webhook registration from step 5.4) is fully wired. See `usertgbot.md` Phase 8 for the full manual verification checklist.

## Other useful commands

```bash
pnpm build        # production build — also catches type errors, run before shipping
pnpm start         # run the production build locally
pnpm exec tsc --noEmit   # type-check only, no build output
```

## Common pitfalls

- **"It builds but auth/DB calls fail"** → check you're using `DsqlSigner`, not `Signer` (see step 4), and that `AWS_ROLE_ARN`/`AWS_REGION` are set.
- **"Table does not exist" / "relation ... does not exist" errors** → the schema bootstrap script (step 3) was never run against this DB instance, or was run before a table/column was added to `lib/db/schema.ts`. Just re-run it — it's always safe.
- **"column ... does not exist" errors (e.g. sign-up succeeds but redirecting to `/home` crashes)** → `lib/db/schema.ts` has a column that `scripts/bootstrap-schema.mjs` never added (see the "Known past drift" note in step 3). Add the missing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statement and re-run the bootstrap script — `CREATE TABLE IF NOT EXISTS` alone won't add columns to a table that already exists.
- **Login succeeds but immediately looks logged out** → check `lib/auth.ts` cookie config (`sameSite`/`secure`) matches your environment; don't disable CSRF/origin checks to "fix" this.
- **Env vars "missing" in a script run via Bash** → the dev server auto-loads `.env.development.local`, but ad-hoc Node scripts don't. Use `node --env-file-if-exists=.env.development.local your-script.mjs`.
- **Telegram `/start` sent but bot never replies** → almost always the webhook is registered against the wrong URL (e.g. the local sandbox preview domain, or a stale domain from a previous session, instead of the current production deployment — Telegram can't reach a local-only preview). Run `getWebhookInfo` and check the `url` field; re-run `setWebhook` against the current production domain if it's wrong (step 5.4). This is the single most likely failure the *next* time this project is started in a new session, since the public URL can change between sessions while the env vars stay the same.
- **Deep link (`t.me/<username>?start=<id>`) 404s or points at the wrong bot** → `TELEGRAM_BOT_USERNAME` almost certainly has a leading `@` in it. The code builds the link as `t.me/${TELEGRAM_BOT_USERNAME}?...`, so the env var must be the bare username only.
- **Telegram webhook secret check always fails / bot token silently used as a webhook secret** → don't ever set `TELEGRAM_WEBHOOK_SECRET` or `TELEGRAM_TOKEN_ENCRYPTION_KEY` to the same value as `TELEGRAM_BOT_TOKEN`, and don't regenerate either once they're already working — regenerating invalidates the already-registered webhook (secret) or makes already-linked BYO bot tokens undecryptable (encryption key). They're separate secrets with separate purposes; the bot token also contains a `:` which some secret-token validators reject.
- **`new URL(...)` throws inside `app/layout.tsx`, `lib/auth.ts`, or `lib/telegram/links.ts`** → this preview environment's `V0_RUNTIME_URL` can arrive with stray wrapping quote characters baked into the value. All call sites that need the app's own origin (`app/layout.tsx`, `lib/auth.ts`, `lib/telegram/links.ts`, `app/developers/page.tsx`, `lib/telegram/commands.ts`) go through `getSiteUrl()` in `lib/env.ts`, which strips wrapping quotes and validates the result — if you add a new call site that needs the app's own origin, import `getSiteUrl()` rather than re-deriving it.
