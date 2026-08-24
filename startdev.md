# Starting This Project Locally

This is a Next.js 16 (App Router) social app called **Pulse**, using:

- **Database**: Amazon **Aurora DSQL** (NOT Aurora PostgreSQL — see warning below) via `pg` + Drizzle ORM, authenticated with short-lived IAM tokens (no static DB password).
- **Auth**: Better Auth (email + password).
- **File storage**: Vercel Blob (private) for avatars, banners, and post media.
- **Package manager**: pnpm (see `pnpm-lock.yaml`).

Follow these steps in order. Skipping the schema step or using the wrong signer package is the most common cause of "it compiles but nothing works" errors.

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
- **Login succeeds but immediately looks logged out** → check `lib/auth.ts` cookie config (`sameSite`/`secure`) matches your environment; don't disable CSRF/origin checks to "fix" this.
- **Env vars "missing" in a script run via Bash** → the dev server auto-loads `.env.development.local`, but ad-hoc Node scripts don't. Use `node --env-file-if-exists=.env.development.local your-script.mjs`.
