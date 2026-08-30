# Starting This Project Locally

This is a Next.js 16 (App Router) social app called **Pulse**, using:

- **Database**: Amazon **Aurora DSQL** (NOT Aurora PostgreSQL — see warning below) via `pg` + Drizzle ORM, authenticated with short-lived IAM tokens (no static DB password).
- **Auth**: Better Auth (email + password).
- **File storage**: Vercel Blob (private) for avatars, banners, and post media.
- **Telegram bot integration**: a built-in shared bot (`@WebBanaiWaterMarkBot`) plus a "bring your own bot" option, letting users manage their account from Telegram. See `usertgbot.md` for the full feature plan and current phase-by-phase status.
- **Package manager**: pnpm (see `pnpm-lock.yaml`).

Follow these steps in order. Skipping the schema step or using the wrong signer package is the most common cause of "it compiles but nothing works" errors.

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
| `BETTER_AUTH_SECRET` | Random 32+ char secret for session signing — generate with `openssl rand -base64 32` if missing. **Not provided by any integration** — prompt the user for it via `SystemAction` (`requestEnvironmentVariables`) the first time it's missing; do not ask them to add it again once set. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
| `TELEGRAM_BOT_TOKEN` | Built-in bot's token from `@BotFather` (e.g. `123456789:AA...`). **Not provided by any integration** — see "Telegram bot setup" below. |
| `TELEGRAM_BOT_USERNAME` | Built-in bot's username, **bare, no leading `@`** (e.g. `WebBanaiWaterMarkBot`, not `@WebBanaiWaterMarkBot`). Used to build the `t.me/<username>?start=<id>` deep link in `/settings/telegram`. |
| `TELEGRAM_WEBHOOK_SECRET` | Random 32+ byte secret (hex/base64, must NOT contain `:`) checked against Telegram's `X-Telegram-Bot-Api-Secret-Token` header on the builtin webhook route. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Never reuse `TELEGRAM_BOT_TOKEN`'s value here** — it contains a `:` and is a different secret with a different purpose. |
| `TELEGRAM_TOKEN_ENCRYPTION_KEY` | Random 32+ byte key (hex/base64) used to AES-256-GCM encrypt BYO bot tokens at rest (`lib/telegram/crypto.ts`). Generate the same way as `TELEGRAM_WEBHOOK_SECRET`, as a **separate** random value — do not reuse it or the bot token. |
| `AI_GATEWAY_API_KEY` | Only needed if AI features are added later |

There is **no static database password**. Auth to the DB works by exchanging Vercel's OIDC token for temporary AWS credentials (`AWS_ROLE_ARN` + `AWS_REGION`), then using those credentials to generate a short-lived DSQL auth token. This requires the app to be running inside a Vercel-connected environment (Vercel Sandbox, Vercel deployment, or a machine with `vercel env pull`'d credentials) — plain local Postgres credentials will not work.

## 3. Bootstrap the database schema (first time only)

The Aurora DSQL cluster starts with zero tables. Run the bootstrap script once to create all tables and indexes:

```bash
node --env-file-if-exists=.env.development.local scripts/bootstrap-schema.mjs
```

This is idempotent (every statement is `IF NOT EXISTS`), so it's safe to re-run if you're ever unsure whether the schema is up to date. Read the comments at the top of `scripts/bootstrap-schema.mjs` before modifying the schema — Aurora DSQL has real limitations that differ from regular Postgres:

- No JSON/JSONB or array column types (JSON is stored as TEXT and encoded/decoded in app code).
- No foreign key constraints (referential integrity is enforced in application code only).
- No `SERIAL` — all ids are app-generated text (e.g. `crypto.randomUUID()`).
- Indexes must use `CREATE INDEX ASYNC` / `CREATE UNIQUE INDEX ASYNC`, B-tree only.
- No extensions (e.g. `pg_trgm`) — text search uses `ILIKE` sequential scans, not trigram indexes.
- Each DDL statement must run in its own transaction.

If you change `lib/db/schema.ts`, update `scripts/bootstrap-schema.mjs` to match and re-run it — there is no separate migration tool.

**⚠️ Known past drift (already fixed, but re-check if you see similar errors):** `posts.attachedServiceId`, `posts.attachedProjectId`, and `posts.attachedTestimonialId` existed in `lib/db/schema.ts` but were missing from `scripts/bootstrap-schema.mjs`'s `posts` table (no matching `CREATE TABLE` column or follow-up `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Sign-up itself succeeded, but the app crashed immediately after with `error: column posts.attachedServiceId does not exist` because the post-signup redirect to `/home` runs `getFeedPosts()`, which selects those columns. This has been fixed by adding the three `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS ...` statements to the bootstrap script and running it. **Whenever you add a column to `lib/db/schema.ts` on an existing table, always add a matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `scripts/bootstrap-schema.mjs` (not just a `CREATE TABLE` column, which is a no-op once the table already exists) and re-run the script — otherwise the schema silently drifts and the first query touching the new column crashes at runtime instead of at build time.**

## 4. ⚠️ Critical: DSQL vs Aurora PostgreSQL signer

`lib/db/index.ts` and `scripts/bootstrap-schema.mjs` MUST both use `DsqlSigner` from `@aws-sdk/dsql-signer`. Do **not** use `Signer` from `@aws-sdk/rds-signer` (that package is for Aurora **PostgreSQL**, a different product with a different auth mechanism). Using the wrong signer causes every DB connection to fail silently or with an opaque auth error, even though the code compiles fine. If you ever see connection/auth errors, check this first.

## 5. Telegram bot setup (one-time, first run only)

The four `TELEGRAM_*` env vars are **not** provided by any integration and won't exist on a fresh checkout — check for them and set them up before the Telegram feature will work end-to-end. See `usertgbot.md` for the full feature plan; this step only covers getting it running.

1. **Check first**: call `GetOrRequestIntegration` with `fetchAll: true` (or check `.env.development.local`) — if all four `TELEGRAM_*` vars below already exist, skip to step 4 (just re-register the webhook, since the deployment URL may have changed).
2. **If missing, create the bot** (requires a human with the Telegram app — cannot be done by the agent): ask the user to open Telegram, message `@BotFather`, send `/newbot`, pick a display name, and pick a `@username` ending in `bot` (must be globally unique). BotFather replies with a token like `123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw`. Get that token and the final username back from the user.
3. **Set the four env vars** via `SystemAction` (`requestEnvironmentVariables`) — never ask the user to add them again once set:
   - `TELEGRAM_BOT_TOKEN` = the token from BotFather, verbatim.
   - `TELEGRAM_BOT_USERNAME` = the username **without** the leading `@`.
   - `TELEGRAM_WEBHOOK_SECRET` = generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` — a fresh random value, **not** the bot token (the bot token contains `:`, which breaks Telegram's secret-token header).
   - `TELEGRAM_TOKEN_ENCRYPTION_KEY` = generate the same way, as a **separate** random value from the webhook secret.
4. **Register the webhook** against the app's real public URL (the production Vercel deployment, not the local dev/preview domain — Telegram must be able to reach it over the internet, and the local sandbox preview domain returns redirects instead of your app's JSON):
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     -H "Content-Type: application/json" \
     -d "{\"url\":\"https://<your-production-domain>/api/telegram/webhook/builtin\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\",\"allowed_updates\":[\"message\",\"callback_query\"]}"
   ```
   Confirm with `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"` — expect no `last_error_message` and `pending_update_count: 0` (or draining to 0).
5. Redeploy to production if the env vars were just added/changed, so the live deployment actually reads the new values (`vercel env pull` locally is not enough on its own — the deployed serverless functions need to be rebuilt with the new env vars too).

## 6. Run the dev server

```bash
pnpm dev
```

The app runs on `http://localhost:3000` by default.

## 7. Verify it's working

- Visit `/signup` and create an account — confirms Better Auth + DB writes work.
- Create a post from `/home` — confirms the rich text editor, post storage, and feed queries work.
- Upload an avatar/banner or attach media to a post — confirms `BLOB_READ_WRITE_TOKEN` / Vercel Blob is configured.
- Visit `/settings/telegram`, click to link the built-in bot, open the deep link in Telegram, send `/start`, enter the code it replies with — confirms the Telegram bot integration is fully wired (see `usertgbot.md` Phase 8 for the full manual verification checklist).

## Other useful commands

```bash
pnpm build        # production build — also catches type errors, run before shipping
pnpm start         # run the production build locally
pnpm exec tsc --noEmit   # type-check only, no build output
```

## Common pitfalls

- **"It builds but auth/DB calls fail"** → check you're using `DsqlSigner`, not `Signer` (see step 4), and that `AWS_ROLE_ARN`/`AWS_REGION` are set.
- **"Table does not exist" errors** → the schema bootstrap script (step 3) was never run against this DB instance.
- **"column ... does not exist" errors (e.g. sign-up succeeds but redirecting to `/home` crashes)** → `lib/db/schema.ts` has a column that `scripts/bootstrap-schema.mjs` never added (see the "Known past drift" note in step 3). Add the missing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statement and re-run the bootstrap script — `CREATE TABLE IF NOT EXISTS` alone won't add columns to a table that already exists.
- **Login succeeds but immediately looks logged out** → check `lib/auth.ts` cookie config (`sameSite`/`secure`) matches your environment; don't disable CSRF/origin checks to "fix" this.
- **Env vars "missing" in a script run via Bash** → the dev server auto-loads `.env.development.local`, but ad-hoc Node scripts don't. Use `node --env-file-if-exists=.env.development.local your-script.mjs`.
- **Telegram `/start` sent but bot never replies** → almost always the webhook is registered against the wrong URL (e.g. the local sandbox preview domain instead of the real production deployment — Telegram can't reach a local-only preview). Run `getWebhookInfo` and check the `url` field; re-run `setWebhook` against the production domain if it's wrong.
- **Deep link (`t.me/<username>?start=<id>`) 404s or points at the wrong bot** → `TELEGRAM_BOT_USERNAME` almost certainly has a leading `@` in it. The code builds the link as `t.me/${TELEGRAM_BOT_USERNAME}?...`, so the env var must be the bare username only.
- **Telegram webhook secret check always fails / bot token silently used as a webhook secret** → don't ever set `TELEGRAM_WEBHOOK_SECRET` or `TELEGRAM_TOKEN_ENCRYPTION_KEY` to the same value as `TELEGRAM_BOT_TOKEN`. They're separate secrets with separate purposes; the bot token also contains a `:` which some secret-token validators reject.
- **`new URL(...)` throws inside `app/layout.tsx`, `lib/auth.ts`, or `lib/telegram/links.ts`** → this preview environment's `V0_RUNTIME_URL` can arrive with stray wrapping quote characters baked into the value. All three call sites (plus `app/developers/page.tsx` and `lib/telegram/commands.ts`) go through `getSiteUrl()` in `lib/env.ts`, which strips wrapping quotes and validates the result — if you add a new call site that needs the app's own origin, import `getSiteUrl()` rather than re-deriving it.
