# Starting This Project Locally

This is a Next.js 16 (App Router) social app called **Pulse**, using:

- **Database**: Amazon **Aurora DSQL** (NOT Aurora PostgreSQL — see warning below) via `pg` + Drizzle ORM, authenticated with short-lived IAM tokens (no static DB password).
- **Auth**: Better Auth (email + password).
- **File storage**: Vercel Blob (private) for avatars, banners, and post media.
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
| `BETTER_AUTH_SECRET` | Random 32+ char secret for session signing — generate with `openssl rand -base64 32` if missing |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
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

## 5. Run the dev server

```bash
pnpm dev
```

The app runs on `http://localhost:3000` by default.

## 6. Verify it's working

- Visit `/signup` and create an account — confirms Better Auth + DB writes work.
- Create a post from `/home` — confirms the rich text editor, post storage, and feed queries work.
- Upload an avatar/banner or attach media to a post — confirms `BLOB_READ_WRITE_TOKEN` / Vercel Blob is configured.

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
