# Test matrix

What tests exist, what they prove, how to run them, and their last
recorded result. Results are only written here from an actual run;
anything not run says NOT RUN or BLOCKED.

## Suites

| Suite | Kind | Location | Command | In CI | Last result |
|---|---|---|---|---|---|
| Web typecheck | static | `tsconfig.json` (strict) | `npm run typecheck` | yes | PASS — 2026-10-28, `77c8649` |
| Web lint | static | `eslint.config.mjs` | `npm run lint` | yes | PASS — 0 errors, 6 warnings — 2026-10-30 (Phase 21) |
| Web unit + route tests | Vitest 5.0.5 | `src/**/*.test.ts(x)` | `npm run test:run` | yes | PASS — 1082 passed, 94 skipped (1176; 108 files) — 2026-10-31 (Phase 22; Phase 21: 1059; Phase 20: 1038; Phase 19: 1024; Phase 18: 978; Phase 17: 960; baseline: 934) |
| Phase 21 on Postgres: publish gate, email completion, suspended, test bookings (count, customer, notifications, accounts, deletion, refused once public), unpublish, import + cross-tenant rollback, downgrade keeps records | DB integration | `src/lib/business/phase21.db.test.ts` | `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/business/phase21.db.test.ts` | no | PASS — 9/9 — 2026-10-30 |
| Phase 22 on Postgres: venues, tenancy approval and isolation, roles by scope, DB constraints, counts-only metrics, booking without a venue | DB integration | `src/lib/venues/phase22.db.test.ts` | `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/venues/phase22.db.test.ts` | no | PASS — 15/15 — 2026-10-31 |
| Phase 22 end to end: admin hierarchy and roles, manager console and isolation, publish gate, owner request and restrictions, approval, public venue page ar/en with SEO, metrics without PII, removal, suspension | HTTP against a production build + QA DB | `scripts/qa-phase22.mjs` | `node scripts/qa-phase22.mjs` (server on :3101) | no | PASS — 56/56 — 2026-10-31 |
| Phase 21 end to end: sign-up → server draft → private business → readiness → policies → owner preview + test booking → publish via email → unpublish → CSV import/rollback (cross-tenant 404) → entitlements and plan gates → demo, help, setup, import pages | HTTP against a production build + QA DB | `scripts/qa-phase21.mjs` | `node scripts/qa-phase21.mjs` (server on :3101) | no | PASS — 44/44 — 2026-10-30 |
| Booking engine on Postgres (P17-01/03/05, R2, R5) | DB integration | `src/lib/bookings/create.db.test.ts` | `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/bookings/create.db.test.ts` | no (needs Postgres) | PASS — 5/5, five consecutive runs — 2026-10-28; 4/4 of the original tests FAIL on the pre-Phase-17 code |
| Phase 17 end to end | Playwright + HTTP against a production build and the QA DB | `scripts/qa-phase17.mjs` | `node scripts/qa-phase17.mjs` (server on :3101) | no | PASS — 13/13 — 2026-10-30 (Phase 21 regression) |
| Booking journeys (ar/en, staff / restaurant / plain, keyboard, validation, Back, retry, cancel, URL compatibility) | Playwright through the real widget | `scripts/qa-booking-e2e.mjs` | `node scripts/qa-booking-e2e.mjs` (server on :3101) | no | PASS — 19/19 — 2026-10-30 (now books tomorrow, sets party size before the table; found the stale-table widget bug, fixed) |
| Page sweep: screenshots, axe WCAG 2.1 AA, overflow, console, focus rings, pixel comparison | Playwright + axe-core, 37 routes × ar/en × 375/768/1024/1440 | `scripts/qa-phase18.mjs` | `node scripts/qa-phase18.mjs --shots DIR [--compare BASELINE]` | no | PASS — 320 loads, 0 overflow, 0 serious/critical axe, 0 missing focus rings — 2026-10-28 |
| Phone normalisation, SQL vs TypeScript | DB invariant | `src/lib/phone-sql.test.ts` | `PHONE_SQL_DATABASE_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/phone-sql.test.ts` | no (needs Postgres) | PASS — 34/34 against local QA Postgres — 2026-10-28 |
| Web build | build | — | `npm run build` | yes (did not run on #28–#31, see CI note) | PASS locally on the Phase 17 branch — 2026-10-28 |
| Booking reliability on Postgres (Phase 19: 50-way contention, idempotency, capacity, state races, discount release, absence, holiday, reschedule, tenant scope) | DB integration | `src/lib/bookings/reliability.db.test.ts` | `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/bookings/reliability.db.test.ts` | no (needs Postgres) | PASS — 13/13 — 2026-10-29 |
| Paymob webhook on Postgres (Phase 19: signed callbacks, replay, 5-way duplicate, out of order, pending→final, decline→revive, cancel mid-payment, mismatch, refund contention + attach) | DB integration | `src/app/api/webhooks/paymob/route.db.test.ts` | same env var, that file | no | PASS — 9/9 — 2026-10-29 |
| Notification outbox on Postgres (Phase 19: claim, outage→retry once, permanent→DEAD, fifth failure→DEAD, stale PENDING pickup, hung claim closed, undeliverable row closed, reminder dedup + stale) | DB integration | `src/lib/notifications/outbox.db.test.ts` | same env var, that file | no | PASS — 8/8 — 2026-10-29 |
| Time zones and the clock change (Phase 19) | unit | `src/lib/bookings/instants.dst.test.ts`, `availability.overnight.test.ts` | `npm run test:run` | yes | PASS — 2026-10-29 |
| Phase 19 end to end: deposit → fake Paymob → webhook → confirmed; replay; decline; cancel mid-payment; 50 for one table; "any table"; one idempotency key × 10; party too large; overnight hours; re-drive cron; claims settled | HTTP against a production build + QA DB | `scripts/qa-phase19.mjs` | see file header (server on :3101 with `PAYMOB_FAKE=1`) | no | PASS — 21/21 — 2026-10-30 (Phase 21 regression; needs `CRON_SECRET=p19-local-cron` on the server). Earlier: 21/21 on the final Phase 19 build, twice in a row (2026-10-29 02:40Z). Two earlier runs on earlier builds failed E1/G1 and found P19-13 (customer upsert race → 500) and P19-14 (pool-start timeout → 500), both fixed |
| Security: cross-tenant, forged claims, roles, injection (bearer tokens) | HTTP against a production build + QA DB | `scripts/qa-security.mjs` | `DATABASE_URL=<qa> AUTH_SECRET=<server's> node scripts/qa-security.mjs http://localhost:3101` | no | PASS — 32/32 — 2026-10-30 (Phase 21 regression) |
| Security Phase 20: headers, CSRF origin check, upload sniffing/folders, account export, sign-out-everywhere, view cap, OTP burning, admin 404 (browser session) | HTTP against a production build + QA DB | `scripts/qa-phase20.mjs` | `node scripts/qa-phase20.mjs` (server on :3101) | no | PASS — 19/19 — 2026-10-30 (Phase 21 regression) |
| Account deletion and the recycled number (Postgres) | DB integration | `src/lib/account/deletion.db.test.ts` | `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/account/deletion.db.test.ts` | no | PASS — 1/1 — 2026-10-29 |
| Route-guard coverage, origin check, session policy, image sniffing | unit | `src/lib/security/*.test.ts` | `npm run test:run` | yes | PASS — 2026-10-29 |
| Backup and restore drill (isolated container) | ops | session scratchpad `restore-drill.sh`; procedure in `docs/runbooks/SECURITY_OPERATIONS.md` § 3 | manual | no | PASS — 10/10 tables match — 2026-10-29 |
| Dependency audit | `npm audit --omit=dev` | web and `mobile/` | CI (web high, mobile critical) | yes (Phase 20) | web 0; mobile 11 (Expo toolchain, S-07) — 2026-10-29 |
| Prettier | format | — | `npm run format:check` | non-blocking | NOT RUN at baseline (known debt) |
| Mobile typecheck | static | `mobile/tsconfig.json` | `cd mobile && npx tsc --noEmit` | no | PASS — 2026-10-28 |
| Mobile lint | static | `mobile/eslint.config.js` | `cd mobile && npx eslint .` | no | PASS — 2026-10-28 |
| Mobile unit tests | Vitest | `mobile/**/*.test.ts(x)` (18 files) | `cd mobile && npx vitest run` | no | PASS — 199 passed, 10 skipped (209) — 2026-10-28 |
| Mobile auth against a real backend | integration | `mobile/features/auth/auth.integration.test.ts` | needs a running API (see file header) | no | NOT RUN (skipped: no backend URL set) |
| Mobile E2E (Android emulator) | Maestro, 19 flows | `mobile/.maestro/` | `.github/workflows/e2e-android.yml` (manual or on flow changes) | separate workflow | **FAIL** — last run on `main`, 2026-10-17; last success 2026-10-14 on `release/audit-fixes` |
| Web E2E: responsive, layout, security | Playwright scripts | `scripts/qa-responsive.mjs`, `qa-security.mjs`, fixtures | `node scripts/<name>.mjs` against a local server + QA DB | no | NOT RUN at baseline; last recorded passes in `docs/qa-phase19.md` / `qa-phase20-responsive.md` |
| Paymob webhook verification | script | `scripts/verify-payment-webhook.mjs` | see `docs/payments-verification.md` | no | NOT RUN at baseline |
| Accessibility (axe) | Playwright + axe-core | part of `scripts/qa-phase18.mjs` | see above | no | PASS — 0 serious/critical on 400 page loads, including the Phase 21 and 22 pages, plus a filled venue page ar/en at 375/1440 — 2026-10-31 |

## Coverage by area

U = unit/route tests, D = database test, E = end-to-end (scripted or
manual QA record), L = live/partner verification.

| Area | U | D | E | L | Gaps |
|---|---|---|---|---|---|
| Slots, overlap, time zones | ✔ | ✔ (Phase 17) | ✔ | — | |
| "Any available", team capacity, shared resources | ✔ | ✔ | ✔ (Phase 17 race) | — | |
| Reminders cron, dashboard Today (Cairo clock) | ✔ (Phase 17) | — | ✔ (22:30 booking in Today) | — | |
| Booking creation, allowance, soft cap | ✔ | ✔ | ✔ (local, PR #31) | — | |
| Plan matrix vs. enforcement | ✔ (source scan, Phase 17) | — | ✔ (pricing pages) | — | |
| Booking email address (P17-03) | — | ✔ | ✔ | — | Live delivery not verified |
| Status transitions | ✔ (one table) | ✔ (confirm vs. cancel race, Phase 19) | ✔ | — | |
| Self-service links | ✔ | — | ✔ | — | |
| Restaurant tables | ✔ | ✔ (capacity, smallest fitting, 50-way, Phase 19) | ✔ (`qa-phase19.mjs`) | — | |
| Multi-branch | partial | — | — | — | Branch-scoped blocks only |
| Search / synonyms | ✔ | — | ✔ | — | |
| Payments ledger, webhook ordering, reaping | ✔ | ✔ (signed callbacks on Postgres, Phase 19) | ✔ (fake provider, Phase 19) | **✘** | No successful real payment; refunds never called live |
| Subscriptions, annual billing | ✔ | — | ✔ (local) | **✘** | Same Paymob gap |
| Notifications pipeline (outbox, retries, dedup) | ✔ | ✔ (Phase 19) | ✔ (claims settled, re-drive cron) | **✘** | Email, WhatsApp, push not verified live |
| Auth (web, mobile tokens, OTP) | ✔ | — | ✔ | partial | WhatsApp OTP delivery depends on Meta |
| Authorization: admin RBAC, business access, bearer coverage, route-guard coverage | ✔ (+ source scan, Phase 20) | — | ✔ (`qa-security.mjs`, `qa-phase20.mjs`) | — | HTTP probes not in CI |
| Tenant isolation | ✔ | ✔ (bookingScope on Postgres, Phase 19) | ✔ (`qa-security.mjs` 32/32, Phase 20) | — | DB tests not in CI |
| Phone normalisation | ✔ | ✔ | — | — | |
| i18n / RTL / `/en` routing | ✔ | — | ✔ | — | |
| Accessibility | — | — | ✔ (axe on every key page, keyboard booking) | — | No real screen-reader session yet |
| Email change / verification | ✔ (Phase 18) | — | — | ✘ | Live delivery of the link not observed |
| Mobile app | ✔ | — | ✘ (Maestro failing) | ✘ | Not in stores; no device verification |

## CI

`.github/workflows/ci.yml` runs on pushes and PRs to `main`, in this
order: a check that the test runner really runs, then typecheck, lint,
unit tests, a minimum test count, the build, and prettier
(non-blocking).

From #28 to #31 the minimum-count step read 0 and failed, so the
build step never ran in CI. The baseline PR points the step at a named
report file.
