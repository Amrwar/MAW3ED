# Test matrix

What tests exist, what they prove, how to run them, and their last
recorded result. Results are only written here from an actual run;
anything not run says NOT RUN or BLOCKED.

## Suites

| Suite | Kind | Location | Command | In CI | Last result |
|---|---|---|---|---|---|
| Web typecheck | static | `tsconfig.json` (strict) | `npm run typecheck` | yes | PASS — 2026-10-28, `77c8649` |
| Web lint | static | `eslint.config.mjs` | `npm run lint` | yes | PASS — 0 errors, 6 warnings — 2026-10-28 |
| Web unit + route tests | Vitest 5.0.5 | `src/**/*.test.ts(x)` (80 files) | `npm run test:run` | yes | PASS — 934 passed, 34 skipped (968) — 2026-10-28 |
| Phone normalisation, SQL vs TypeScript | DB invariant | `src/lib/phone-sql.test.ts` | `PHONE_SQL_DATABASE_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/phone-sql.test.ts` | no (needs Postgres) | PASS — 34/34 against local QA Postgres — 2026-10-28 |
| Web build | build | — | `npm run build` | yes (did not run on #28–#31, see CI note) | Vercel production build of `77c8649` succeeded |
| Prettier | format | — | `npm run format:check` | non-blocking | NOT RUN at baseline (known debt) |
| Mobile typecheck | static | `mobile/tsconfig.json` | `cd mobile && npx tsc --noEmit` | no | PASS — 2026-10-28 |
| Mobile lint | static | `mobile/eslint.config.js` | `cd mobile && npx eslint .` | no | PASS — 2026-10-28 |
| Mobile unit tests | Vitest | `mobile/**/*.test.ts(x)` (18 files) | `cd mobile && npx vitest run` | no | PASS — 199 passed, 10 skipped (209) — 2026-10-28 |
| Mobile auth against a real backend | integration | `mobile/features/auth/auth.integration.test.ts` | needs a running API (see file header) | no | NOT RUN (skipped: no backend URL set) |
| Mobile E2E (Android emulator) | Maestro, 19 flows | `mobile/.maestro/` | `.github/workflows/e2e-android.yml` (manual or on flow changes) | separate workflow | **FAIL** — last run on `main`, 2026-10-17; last success 2026-10-14 on `release/audit-fixes` |
| Web E2E: responsive, layout, security | Playwright scripts | `scripts/qa-responsive.mjs`, `qa-security.mjs`, fixtures | `node scripts/<name>.mjs` against a local server + QA DB | no | NOT RUN at baseline; last recorded passes in `docs/qa-phase19.md` / `qa-phase20-responsive.md` |
| Paymob webhook verification | script | `scripts/verify-payment-webhook.mjs` | see `docs/payments-verification.md` | no | NOT RUN at baseline |
| Accessibility (axe) | — | `axe-core` is installed, **nothing runs it** | — | no | MISSING |

## Coverage by area

U = unit/route tests, D = database test, E = end-to-end (scripted or
manual QA record), L = live/partner verification.

| Area | U | D | E | L | Gaps |
|---|---|---|---|---|---|
| Slots, overlap, time zones | ✔ | — | ✔ | — | No DB-level test of concurrent double-booking |
| Booking creation, allowance, soft cap | ✔ | — | ✔ (local, PR #31) | — | |
| Status transitions | ✔ | — | ✔ | — | |
| Self-service links | ✔ | — | ✔ | — | |
| Restaurant tables | partial | — | — | — | No table-assignment tests |
| Multi-branch | partial | — | — | — | Branch-scoped blocks only |
| Search / synonyms | ✔ | — | ✔ | — | |
| Payments ledger, webhook ordering, reaping | ✔ | — | ✔ (fake provider) | **✘** | No successful real payment; refunds never called live |
| Subscriptions, annual billing | ✔ | — | ✔ (local) | **✘** | Same Paymob gap |
| Notifications pipeline | ✔ | — | partial | **✘** | Email, WhatsApp, push not verified live |
| Auth (web, mobile tokens, OTP) | ✔ | — | ✔ | partial | WhatsApp OTP delivery depends on Meta |
| Authorization: admin RBAC, business access, bearer coverage | ✔ | — | ✔ (`qa-security.mjs`, manual) | — | Not in CI |
| Tenant isolation | ✔ | — | ✔ (manual) | — | Not in CI |
| Phone normalisation | ✔ | ✔ | — | — | |
| i18n / RTL / `/en` routing | ✔ | — | ✔ | — | |
| Accessibility | — | — | partial (manual, H20) | — | No automated check |
| Mobile app | ✔ | — | ✘ (Maestro failing) | ✘ | Not in stores; no device verification |

## CI

`.github/workflows/ci.yml` runs on pushes and PRs to `main`, in this
order: a check that the test runner really runs, then typecheck, lint,
unit tests, a minimum test count, the build, and prettier
(non-blocking).

From #28 to #31 the minimum-count step read 0 and failed, so the
build step never ran in CI. The baseline PR points the step at a named
report file.
