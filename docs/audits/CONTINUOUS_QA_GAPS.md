# Continuous QA gaps

What the automated checks do not catch today, found during the post-Phase-28 audit (2026-11-06). Ordered by risk.

## Gaps closed in this audit

| Gap | New guard |
|---|---|
| Dashboard pages (not only the layout) could send a stale token to /onboarding and loop | `onboarding-loop.test.ts` → "dashboard pages": scans every `src/app/dashboard/**/page.tsx` |
| Phone-code sign-in into owner and admin accounts | `lib/auth/phone-signin-policy.test.ts` |
| Translation model call had no timeout | `translate.test.ts`: "bounds the model call with a timeout" |

## Open gaps

| # | Gap | Why it matters | Proposed check |
|---|---|---|---|
| Q-1 | Recycled phone number with no deletion: nothing tests what a new holder sees | The new holder sees the old holder's account and bookings (audit S-2) | `.db.test` once the S-2 design lands: an old user whose sign-in and bookings are older than the staleness window → a fresh account fenced at now |
| Q-2 | `.db.test.ts` files (22 files, 228 tests) are skipped without a database | Organization, venue, payments and webhook behaviour is only proven when someone runs them by hand | CI job with a throwaway Postgres (Neon branch or a service container) running `vitest run` with `DATABASE_URL` set |
| Q-3 | No browser E2E in CI against a deployed preview | Hydration and redirect regressions reach production unseen | Playwright smoke on the Vercel preview: home, /businesses, one company page, booking widget to the confirm step, /en variants |
| Q-4 | No overlap guard on crons; nothing tests two concurrent runs | Translations can pay twice for the same model calls; reminders rely on dedupe | `translations/route.test.ts`: two concurrent GETs and a mocked model, assert one call per business (fails today). Fix with a Postgres advisory lock in `lib/ops/cron-run.ts` |
| Q-5 | Reminders cron reads `take: 1000` by start time; bookings at businesses with reminders off are re-read every hour | Could starve later reminders at scale | `reminders/route.test.ts`: 1000 early bookings with reminders disabled plus one later enabled one → assert it is sent |
| Q-6 | Mobile payment-status polling: fixed 3 s, no error backoff | Battery and API load while the network is failing | `mobile/features/booking/queries.test.ts` with fake timers and a failing `api.get`: assert the call count stays within the cap |
| Q-7 | Stripe webhook: the claim is released only on a thrown error | If the function is killed mid-handler, Stripe's retry is acked as "duplicate" and lost | `route.db.test.ts`: a claim older than N minutes with no completion → reprocessed |
| Q-8 | Public copy versus behaviour (FAQ vs help vs product rules) | Contradictions like the cancellation cutoff slip through | A unit test that FAQ and help answers mentioning cutoffs do not hard-code a number of hours |
| Q-9 | No accessibility or Lighthouse budget in CI | Regressions are found by hand | `@axe-core/playwright` on the Q-3 smoke pages, and Lighthouse CI with performance ≥ 0.8 and accessibility ≥ 0.95 on home and one company page |
| Q-10 | Live-site content checks (price labels, categories, missing English) | Listing quality is invisible to tests | A weekly script: fetch the sitemap, flag company pages with "Price on request" on every service, Arabic text on /en pages, or a category mismatch. Report only |
| Q-11 | `eslint .` reports 2,457 errors and 30,985 warnings repository-wide, while `eslint src` has 0 errors and 6 warnings | The repo-wide number cannot be a gate: every error is outside `src/` | Add ignores to `eslint.config.mjs` (mobile build output, generated files) so `npm run lint` can gate CI |
