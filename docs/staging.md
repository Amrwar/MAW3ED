# Staging server

`https://maw3ed-staging.vercel.app` — a test backend for the app's device
tests (Maestro on EAS) and for trying things without touching customers.
Set up 2026-11-03.

## What it is

| | |
|---|---|
| Vercel project | `maw3ed-staging`, separate from `maw-3-ed` (production). Not connected to Git: it changes only when someone deploys to it (below) |
| Database | Neon `maw3ed-staging` (Vercel Marketplace, free plan), connected to this project only. Production's database is not reachable from it |
| Data | Fictional only: the reference data (`prisma/seed.ts`) and the QA fixtures (`scripts/qa-fixtures.mjs`, `scripts/qa-layout-fixtures.mjs`): 12 published businesses (some with realistic-sounding made-up names, from the layout fixtures), 20 services, every business bookable. Nothing copied from production |
| Search engines | Kept out: `SITE_NOINDEX=1` makes robots.txt disallow everything and adds `X-Robots-Tag: noindex` to every response |
| Accounts | **One** account can sign in: the review account, a business owner (`review@staging.maw3ed.test`), with a long random password. Every other account has no password, and **no account has an admin role** — the server is public |
| Variables | Its own `AUTH_SECRET`/`NEXTAUTH_SECRET`, `PSEUDONYM_SECRET`, `CRON_SECRET`; its own address in `AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_HOST`; `SITE_NOINDEX=1`; the Neon variables. None of production's |
| Not configured, on purpose | WhatsApp, SMS, Resend (email), Paymob, Cloudinary, Sentry. Nothing it does can message a person, take a payment or store an upload |

### What it cannot do

These are refused on every Vercel deployment by design, and staging does
not change that:

- customer sign-in by phone code (there is no WhatsApp, and a deployment
  never writes the code to its log);
- the access sandbox (visitor passes) and fake Paymob checkout.

The device tests do not need them: they browse, stop a guest booking at
"Sign in to book", and sign the review account in with email and
password. Use the local QA server (`scripts/qa-*.mjs`) for everything that
does.

### Why a separate project, not a staging branch of `maw-3-ed`

`maw-3-ed`'s preview deployments share production's variables (database,
Paymob, WhatsApp) and sit behind Vercel Authentication. That is right for
them, but a phone app cannot pass that wall. A bypass secret inside the
app would open every preview, including those on production's database.
A separate project has none of production's values, and its own address
is public.

## The review account

The device tests sign in with it. Its password is not in this repository.
It was handed to the owner once, to store in EAS:

```
EAS → project maw3ed → Environment variables → preview, secret:
  MAESTRO_REVIEW_EMAIL     review@staging.maw3ed.test
  MAESTRO_REVIEW_PASSWORD  (the value given to the owner)
```

To replace it, set a new bcrypt hash on that user in the staging database
(never the production one).

## Deploying to it

From a clean checkout of the commit to deploy, linked to `maw3ed-staging`:

```
git worktree add --detach ../maw3ed-staging-src origin/main
cd ../maw3ed-staging-src
vercel link --yes --project maw3ed-staging   # writes .env.local: delete it
vercel deploy --prod --yes
```

The project's settings: framework Next.js, Node 24.x (as production).

## Rebuilding its database

On the local QA Postgres (`maw3ed-qa`), never against the hosted one:

1. Create an empty database and copy the QA schema into it, schema only:
   `pg_dump --schema-only maw3ed_qa | psql maw3ed_staging_build`.
2. `npx tsx prisma/seed.ts`, then `node scripts/qa-fixtures.mjs` and
   `node scripts/qa-layout-fixtures.mjs`, with `DATABASE_URL` pointing at
   the local build database. The fixtures refuse any non-local database.
3. Lock it down: remove every admin role, clear every password but the
   review account's, and give that one a new random password.
4. `pg_dump -Fc` it, and `pg_restore` into the staging Neon database
   (`DATABASE_URL_UNPOOLED` of the `maw3ed-staging` project, after
   checking it is that project's).
