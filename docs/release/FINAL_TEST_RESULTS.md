# Final test results

Final audit, 2026-11-05.

**Environment:**
- Windows 11.
- Node 22.16.
- Postgres 17 in Docker (`maw3ed-qa`, every migration applied).
- The production build served by `next start -p 3101` with `ACCESS_SANDBOX=1`, `PAYMOB_FAKE=1`, `WEBHOOK_ALLOW_PRIVATE=1` (local only).
- The app's web build (`expo export --platform web`) served on :8090.

Every number below comes from a command run in this audit. The logs were
kept in the session's scratch folder. **Nothing ran against production
except read-only GETs, and nothing charged anyone.**

Two full rounds were run:
- **Round 1:** `main` at `d9e8ece`, before any fix. It established the
  baseline and found the outbox test failure (T-01).
- **Round 2:** the final branch (`final-audit`, after all fixes and review
  fixes), on a fresh build. Round 2 is the result of record.

## Static checks and builds (round 2)

| Command | Result |
|---|---|
| `npx tsc --noEmit` (web) | **PASS**, 0 errors |
| `npx eslint` (web) | **PASS**, 0 errors, 9 warnings (pre-existing `<img>` and similar) |
| `npx next build` | **PASS** |
| `npx tsc --noEmit` (mobile) | **PASS** |
| `npx eslint .` (mobile) | **PASS** |
| `npx expo export --platform web` (mobile) | **PASS** |
| `npm audit --omit=dev --audit-level=high` (web) | **PASS**: 5 moderate, 0 high, 0 critical |
| `npm audit --omit=dev` (mobile) | 25 (2 low, 17 moderate, **6 high**): Expo toolchain, tracked S-07. CI blocks only critical |

## Automated suites (round 2)

| Suite | Passed | Failed | Skipped | Notes |
|---|---|---|---|---|
| Web unit (`vitest run`, no database) | 1,305 | 0 | 221 | Skipped = database tests without `BOOKING_DB_TEST_URL` |
| Web full with database (`BOOKING_DB_TEST_URL=… vitest run`) | 1,493 | 0 | 34 | The 34 need `PHONE_SQL_DATABASE_URL` and were run separately: |
| Phone SQL parity (`PHONE_SQL_DATABASE_URL=…`) | 34 | 0 | 0 | |
| **Web total** | **1,527** | **0** | **0** | Round 1 had 1 failure (T-01, a test defect, fixed) |
| Mobile unit (`vitest run`) | 240 | 0 | 10 | Skipped: device-only |

New regression tests from this audit (all included above):
- `permissions-policy`, `push-session`, `account/delete/route`
- `reports/operations/route`, `venues/guard-suspended`
- `ssrf-pinned` (including a slow-receiver deadline), `webhook-branches`
- `live-grants`, `auth-page-loop`, `run-deadline`
- `rate-limit` (S-01), `staff/route`, `sentry-scrub`
- `business/route`, `entitlements/auto-resume.db`
- From the payments work:
  - `paymob-order`, `ledger-race.db`, `create-month-key`
  - `entitlements/move.db`, `business/bookings/[id]/payments/route.db`
  - extensions to the Paymob and Stripe webhook DB tests, including the
    concurrent Dashboard-refund race
- `final-audit-content` (15 checks)

## QA battery against the production build (round 2)

| Script | What it covers | Result |
|---|---|---|
| qa-phase28 | Two organizations: provisioning, isolation, API, webhooks, consoles | **46/46** |
| qa-phase27 | Loyalty, packages, memberships, waitlist, desk, no-show | **66/66** |
| qa-phase26 | Search, discovery, funnel | **114/114** |
| qa-phase26-browser | Discovery and consoles in a browser, axe | **35/35** |
| qa-phase24 | Restaurant group, mall, clinic group, customer journey | **147/147** |
| qa-phase24-browser | Journeys in a browser, offline, ar/en × 375/1440 | **23/23** |
| qa-redirects | Locale and auth redirects | **108/108** |
| qa-offline-qr | Offline booking QR in Chromium, WebKit, Firefox | **31/31** |
| qa-responsive | 10 devices × 2 languages | **380 loads, none wider than the screen** |
| qa-booking-e2e | Customer booking end to end | **22/22** |
| qa-phase23 | Check-in, visitor passes, tampered callbacks | **48/48** |
| qa-phase23-loops | Access loops and bounds | **15/15** |
| qa-security | Authorization and abuse checks | **32/32** |
| qa-phase23-browser | Access in a browser | **49/49** |
| qa-loops-browser | Render/request loops | **9/9** |
| qa-venue-console, qa-venue-page | Venue console and page | **clean** |
| qa-phase22c | Relationship types, delegation, hierarchy | **59/59** |
| qa-phase22b | Organizations, directories | **84/84** |
| qa-phase22 | Venues | **68/68** |
| qa-phase21 | SaaS onboarding, publishing | **44/44** |
| qa-phase20 | Admin and authorization | **19/19** |
| qa-phase19 | Reliability, notifications | **21/21** |
| qa-phase17 | Booking integrity | **13/13** |
| qa-phase18 | Every page × role × language × width, axe, console, keyboard | **544 loads, 1 flagged** (see below) |
| qa-perf-delegate | Delegate pages | clean |
| qa-phase24-load | Load and concurrency | **13/13** (round 1: 10/13, latency only) |
| qa-phase26-perf, qa-phase28-perf | Page and large-tenant timings | measured (`FINAL_PERFORMANCE_REPORT.md`) |
| **qa-phase25-app** | The app's own screens and API calls, in its web build | **35/35** |
| **qa-final-audit** (new) | Fixes end to end: camera policy, footer help, robots, a live session still sent home, sign-out-everywhere removes push tokens, **a revoked session reaches the sign-in form with no redirect loop** (after the 5½-minute re-check) | **8/8** |

**The one flagged load:** `/admin/onboarding`, Arabic, 375 px, 21 console
errors. It was clean in round 1, and three fresh loads after the battery
showed 0 errors each. It overlapped with the app QA script hitting the same
server. Recorded as transient and not reproduced, not as a pass.

## Deployment and restore

| Check | Result |
|---|---|
| Backup workflow on GitHub | Its only scheduled run (2026-11-02) **failed**: the cause was found and fixed (F-01). Re-run after merge is required |
| Restore drill | Phase 28 on QA (identical schema and counts). Not repeated in this audit |
| Rollback | Rehearsed on staging in Phase 28 (5 s each way) |
| Production, read-only | `/api/version` = `d9e8ece`; `/api/health` 200; 64/64 sitemap URLs 200; security headers present |

## Not run, or blocked

| Item | Why |
|---|---|
| Android and iOS release builds, device tests, Maestro | No signed builds, no device access in this audit; the Android E2E workflow fails on `main` for want of an APK (CI-01) |
| Real payments (Paymob, Stripe live) | Never run automatically against real money, as required |
| Live WhatsApp, email and push delivery | Provider-side; not exercised |
| Real gate provider, real organization or operator | None exists |
| Third-party penetration test, Core Web Vitals field data | Outside this repository |

## Totals

| | Count |
|---|---|
| Automated test cases passed (web 1,527 + mobile 240) | **1,767** |
| QA checks passed in scripted runs | **1,109** checks across 24 counted scripts, plus 924 page loads (380 + 544) and two clean venue sweeps |
| Failed (round 2) | **0** test cases. 1 page load flagged, not reproduced |
| Skipped | 10 mobile device-only tests |
| Blocked / not run | Mobile release and devices, real payments, live messaging, partners (above) |
