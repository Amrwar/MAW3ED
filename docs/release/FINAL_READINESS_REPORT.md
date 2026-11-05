# MAW3ED — final readiness report (phases 1–28)

Final audit, 2026-11-05. Base: `main` at `d9e8ece` (Phase 28 merged, live).
Fixes: branch `final-audit`. Companion reports in this folder:

| Report | Covers |
|---|---|
| `FINAL_REQUIREMENTS_MATRIX.md` | Each requirement against evidence |
| `FINAL_TEST_RESULTS.md` | Every command run and its counts |
| `FINAL_BUG_REGISTER.md` | Every confirmed defect, fixed or open |
| `FINAL_INFINITE_LOOP_AUDIT.md` | Loops and bounds |
| `FINAL_SECURITY_AUDIT.md` | Security |
| `FINAL_PERFORMANCE_REPORT.md` | Performance |
| `FINAL_DATABASE_INTEGRITY.md` | Database |
| `FINAL_DEPLOYMENT_CHECKLIST.md` | Deployment |
| `FINAL_OPERATIONAL_RUNBOOK.md` | Operations |
| `EXTERNAL_DEPENDENCIES.md` | Outside dependencies |
| `POST_LAUNCH_MONITORING.md` | Monitoring |

## How this audit was done

1. **Established the real state** instead of trusting the phase reports:
   the roadmap, status and feature inventory were compared with the code,
   CI history, the backup and E2E workflow runs, the production environment
   (variable names only) and the live site (read-only GETs).
2. **Six independent code reviews**, each given the code rather than earlier
   conclusions: booking and payments; security and authorization;
   organizations, venues, visitor access and enterprise; repository-wide
   unbounded processing; the mobile app; the website's pages and content.
3. **Every finding was confirmed in code** before it was fixed. Each fix has
   a regression test, which was run with the fix removed and seen to fail
   (exceptions are named in the bug register).
4. **An independent review of the fixes themselves** (`/code-review`). Its
   ten findings were fixed or, in one case, shown wrong: it proposed dating
   entitlements by the wall-clock column, which would have shifted every
   check by Cairo's offset.
5. **Re-ran everything on the final code:** typecheck, lint, the unit and
   database suites, the build, the dependency audits, the whole 29-script QA
   battery on a fresh production build, the app's web build, and a new
   end-to-end script for the fixes.

Nothing ran against production except read-only GETs. Nothing charged
anyone.

## Headline

- **The code is in good shape.** No P0 or P1 cross-tenant exposure was
  found. Concurrency, retries and loops are bounded and tested. Every
  automated suite passes on the final build.
- **The audit found and fixed real defects:** 3 P1, 17 P2 and 18 P3, plus
  part of a P0 legal gap. The most important:
  - the off-site backup had **never** worked (fixed; backup and restore verified 2026-11-05);
  - an organization granted only REPORTS could read revenue and staff commission;
  - a second Paymob order for the same booking would be refused;
  - a revoked session sent the browser into a redirect loop;
  - payment status updates could race;
  - a suspended organization kept running its venues.
- **What stands between this and a real launch is mostly not code:**
  - legal text (the operator's identity, money terms);
  - a first real payment and refund on each provider;
  - live WhatsApp delivery;
  - store builds and device tests;
  - any real organization, operator or gate partner.

## O. Release verdicts

| # | Subsystem | Verdict | Why |
|---|---|---|---|
| 1 | Public Maw3ed website | **CONDITIONAL GO** | All 64 public URLs 200 on production; RTL/LTR and accessibility checks clean locally. Condition: legal pages name the operator, and the privacy notes (retention, minimum age) are completed |
| 2 | Customer booking system | **CONDITIONAL GO** | The engine, concurrency (0 double bookings under racing load), state machine, time zones and self-service are verified locally. Conditions: cancellation and no-show terms in the Terms. Online deposits are excluded (see 11) |
| 3 | Business SaaS platform | **CONDITIONAL GO** | Dashboard, onboarding, publishing, staff, reports and entitlements verified locally. Conditions: plan payments proven once live (11); legal terms for subscriptions |
| 4 | Organizations and business groups | **CONDITIONAL GO** | Isolation and delegation verified with two fictional organizations (46/46, 147/147). Three permission leaks fixed. Conditions: the processor-terms decision for shared customer data; first real organization onboarded under supervision |
| 5 | Hosted mall / venue functionality | **CONDITIONAL GO** (directory and console) | Venue pages, memberships and the console verified locally; suspension now stops venues. No real operator has used it |
| 6 | Booking QR and check-in | **CONDITIONAL GO** | Verified locally and offline (31/31 across three engines). The camera scanner was blocked by a header (F-02, fixed): **confirm on a phone** before relying on scanning; paste/type works meanwhile |
| 7 | Optional visitor access | **BLOCKED / NOT VERIFIED** | Works with the sandbox only. No real gate provider, agreement or specification |
| 8 | Real Emaar integration | **BLOCKED / NOT VERIFIED** | Concept only; nothing configured; no compatibility claimed |
| 9 | Android application | **BLOCKED / NOT VERIFIED** | Code passes (240 tests, contracts match the server). No release build tested on a device; Maestro has no APK; app links unset |
| 10 | iOS application | **BLOCKED / NOT VERIFIED** | No build at all |
| 11 | Payments and subscriptions | **NO-GO** for taking real money | Ledger, webhooks, refunds and reconciliation are verified with fake providers, and 8 payment defects were fixed. **But no real Paymob payment has ever succeeded**, Stripe has no live payment, the Stripe account had payouts paused, there is no payout path for deposits, and the terms say nothing about money. Becomes CONDITIONAL GO after one real payment and refund on each provider and the money terms |
| 12 | Notifications and background processing | **CONDITIONAL GO** | Outbox, retries, dead-letter and cron bounds verified. Deadlines and stable ordering added. Conditions: one live WhatsApp and email delivery confirmed; the backup re-run (F-01) |
| 13 | Enterprise multi-venue system | **CONDITIONAL GO** (code) | API, keys, webhooks and contracts verified locally (46/46); SSRF hardened. Real partner validation NOT DONE — no real contract, consumer or provider |
| 14 | Overall platform security | **CONDITIONAL GO** | No open P0/P1. Open P2: self-review (decision) and a latent flag that must stay off. Conditions: legal review; a third-party penetration test before enterprise contracts |
| 15 | Overall production operations | **CONDITIONAL GO** | Health, job records, flags, rollback (rehearsed) and restore (drilled on QA) are in place. The fixed backup was run and restored from its artifact on 2026-11-05. Conditions: uptime monitor and Sentry alert rules |

No subsystem gets an unconditional GO. Every one depends on at least one
external confirmation that this repository cannot produce.

## P. Remaining work, by priority

**Before any public launch**
1. Owner: merge `final-audit` (no migration). Done: merged as `2d0e443`; the backup
   was run by hand and restored into a scratch database on 2026-11-05 (F-01).
2. Owner/counsel: name the operator on the privacy and terms pages. Complete
   retention and minimum age. Write terms for plans, deposits, refunds,
   cancellation, no-shows, liability and governing law (F-30b).
3. Owner: uptime monitor on `/api/health`; Sentry alert rules.
4. Owner, on a phone: the check-in camera prompt (F-02); "sign out
   everywhere" leaves no push on the old phone (F-03).

**Before taking money**
5. One real Paymob payment and refund, including a second order for the
   same booking (F-10).
6. One real Stripe plan payment and refund. Clear the Stripe account task;
   fix the public business name.
7. Decide how deposits reach businesses (payout), or switch deposits off
   until decided.

**Before the apps**
8. Signed Android and iOS builds; set `APPLE_TEAM_ID` and
   `ANDROID_CERT_SHA256`; device tests (push, links, keychain, offline QR);
   Maestro with an APK URL.
9. Fix M-03 before ever enabling `BOOKING_PHONE_VERIFICATION`.

**Product decisions**
10. Reviews on walk-in or business-entered bookings (S-02).
11. Processor terms for organization access to customers.
12. Whether the mobile "preview" profile should use production (M-07).

**Engineering, P3**
13. Buffer minutes under races (B-08); `sid` in mobile access tokens (S-05).
14. OTP purpose (S-07); retention prunes (L-01); pause realtime in hidden
    tabs (L-02).
15. Cursors for the operations and notice jobs at scale; the Expo SDK
    upgrade for the toolchain advisories.

**Partners**
16. Real organization pilot.
17. Gate-provider agreement and adapter.
18. Emaar/Eterna, only with a written agreement.

## A. Implemented feature inventory (verified in code and tests)

- **Public site (ar/en):**
  - directory with Arabic-aware search, categories, cities and districts, city × category pages;
  - business profiles with JSON-LD;
  - organization and venue directories;
  - pricing from one source; help centre; legal pages; account deletion.
- **Booking:**
  - services, staff, resources and tables; capacity and party size;
  - policies; guest checkout; self-service by token (cancel, reschedule, calendar, review);
  - recurring series; waitlist with offers;
  - packages, memberships and loyalty; walk-ins and no-shows;
  - booking QR, check-in desk, offline QR.
- **Business SaaS:**
  - onboarding, readiness and publish; staff roles; CRM;
  - reports and operations report; discounts; CSV import;
  - plans with entitlements; Stripe and Paymob plan payments (code); demo workspace.
- **Organizations:**
  - OWNED, HOSTED and MANAGED relationships;
  - delegation with scopes and branch limits;
  - a 3-level hierarchy;
  - public directories and marketing QR;
  - portfolio and loyalty across brands;
  - enterprise API v1, keys, webhooks, contracts.
- **Venues and access:**
  - venues, compounds, gates, policies and the venue console;
  - visitor and guest passes through a provider interface (sandbox only).
- **Platform:**
  - admin with RBAC; moderation; payments and reconciliation; audit log;
  - Operations page; health; job records; feature flags.
- **Mobile (Expo):**
  - customer and business app;
  - Arabic and English, offline cache, deep links, push (code);
  - not released.

## B. Completed development phases

Phases 17–28 merged and live (see `docs/roadmap/PHASE_STATUS.md`). Their
verdicts are the ones recorded there. Phase 25 (native builds), Phase 23 E
and Phase 24 item 9 (a real gate or Emaar) are BLOCKED on outside parties.

## C. Incomplete or blocked requirements

- **Never succeeded:** a real Paymob payment; a live Stripe payment.
- **No payout path:** deposits have no way to reach the business.
- **Legal:** money terms and the operator's identity.
- **Apps:** native builds, store listings, device tests.
- **Messaging:** live WhatsApp and push delivery not evidenced.
- **Partners:**
  - a real gate provider;
  - Emaar/Eterna;
  - a real organization pilot;
  - enterprise partner validation.
- **Not built:**
  - multi-service bookings, shared-capacity classes, online package sale (Phase 27);
  - SMS (no provider);
  - Google sign-in.

## D. Tests

See `FINAL_TEST_RESULTS.md`:
- **Automated test cases:** 1,767 passed, 0 failed (web 1,527, all run;
  mobile 240, plus 10 device-only skipped).
- **Scripted QA:** 1,109 checks across 24 scripts plus 924 page loads, on
  the final build: all pass. One page load was flagged and does not
  reproduce.
- **Blocked or not run:** mobile release and devices, real payments, live
  messaging, partners.

## E. Bugs

See `FINAL_BUG_REGISTER.md`:

| Severity | Found | Fixed | Open |
|---|---|---|---|
| P0 | 1 (legal text) | the Stripe disclosure | the rest is for the owner and counsel |
| P1 | 3 | 3 | 0 |
| P2 | 19 | 17 | 2 (one decision, one latent flag) |
| P3 | 30 | 18 | 12 |

## F. Infinite-loop audit

See `FINAL_INFINITE_LOOP_AUDIT.md`.
- **Inspected:** frontend effects and redirects, crons, queues, retries,
  webhooks, access sync, automations, the database trigger, mobile auth,
  navigation and listeners.
- **Real issues:**
  - one redirect loop (F-27, fixed, proven end to end after the 5½-minute
    re-check);
  - a cron with no deadline (F-28);
  - three scans that could re-read the same rows (F-29).
- **Remaining:** bounded at-scale risks, listed with their bounds.

## G. Security readiness

CONDITIONAL GO (`FINAL_SECURITY_AUDIT.md`).
- No open P0 or P1 cross-tenant exposure.
- One P1 permission leak and six P2 issues fixed.
- Still needed: legal review and a third-party penetration test.

## H. Performance readiness

Fast on one PC (`FINAL_PERFORMANCE_REPORT.md`):
- page LCP 0.2–0.7 s;
- API p95 under 130 ms;
- load test 13/13 on the final build (10/13 in round 1, latency only).

Not validated at production scale or with field data.

## I. Database and data integrity

See `FINAL_DATABASE_INTEGRITY.md`.
- **What the database guarantees:**
  - 92 tables, 127 foreign keys, 49 CHECKs;
  - three exclusion constraints against double-booking;
  - one bounded trigger;
  - nothing left NOT VALID.
- **Schema drift:** one-way and deliberate, so `db:push` must never run.
- **Fixed:** six data-integrity defects.
- **Backups:** the off-site backup had never worked (fixed; run and restore verified 2026-11-05).

## J. Mobile readiness

**Android and iOS: BLOCKED / NOT VERIFIED.**
- The code is sound: 240 tests; API contracts match the server; 35/35 in
  the app's web build.
- Three mobile defects were fixed. One latent defect stays (M-03): keep the
  phone-verification flag off.
- No release build, device test, push or app-link verification.

## K. Emaar/Eterna readiness

**BLOCKED / NOT VERIFIED.**
- Concept only: no agreement, specification, credentials or test gate.
- Nothing in the code or on the site claims compatibility.
- The generic organization and venue features were verified with fictional
  data only.

## L. Enterprise readiness

**CONDITIONAL GO (code).**
- Verified locally with two fictional organizations; hardened in this audit.
- No real partner validation.

## M. Deployment readiness

**CONDITIONAL GO.**
- This release needs no migration.
- Before any launch:
  - an uptime monitor and alert rules.
- Rollback is rehearsed; migrations are additive.
- See `FINAL_DEPLOYMENT_CHECKLIST.md`.

## N. External dependencies

See `EXTERNAL_DEPENDENCIES.md`:
- Paymob, Stripe and Meta (live proof);
- Apple, Google and Expo (builds);
- a gate provider and Emaar (agreements);
- counsel (terms);
- Neon retention (confirm).
