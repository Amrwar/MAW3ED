# Phase 22 — mandatory post-phase audit

**Phase:** 22 final — organizations, ownership (OWNED), hosting (HOSTED)
and delegated management (MANAGED), on top of Phase 22 (venues) and 22b
(the organization platform). Branch `phase-22-final`, PR #46.
**Date:** 2026-10-31. **Environment:** local QA only — Docker Postgres
`maw3ed-qa` with every migration applied, production build (`next start`)
on :3101, Chromium via Playwright, Node 22. **Nothing in this audit was
run against production.**

The audit did not trust the phase report: it re-read the requirements,
the code, the tests, and ran everything again. It found three new defects
(two P2 loop/performance defects, one P3 hardening), fixed them, and an
independent re-review of those fixes found four more defects in them,
fixed in turn. Details: `PHASE_22_LOOP_AUDIT.md`; every test run:
`PHASE_22_REGRESSION_RESULTS.md`; what remains: `PHASE_22_OPEN_ISSUES.md`.

## 1. Requirement checklist (the owner's Phase 22 final prompt)

| Requirement | Status | Evidence |
|---|---|---|
| OWNED: operate within granted scopes; ownership alone grants nothing | PASS | phase22c DB "2/11"; 22c E2E 2, 4 |
| HOSTED: directory, invitations, categories, order, location, public page, QR — and never records, bookings, medical data, finance, payments, payroll, settings | PASS | DB "3/8/9" (code, API and DB CHECK refuse); 22c E2E 8/9 |
| MANAGED: delegation, granular scopes, branch limits, expiry, immediate revocation, audit, no escalation | PASS | DB "4/22", "6/12", "7/10"; 22c E2E 4, 10, R1–R5 |
| Multiple simultaneous relationships, no duplication | PASS | DB "5/13" |
| Organization registration (every listed type) with identity, logo, branding, contact, location, members, businesses, directory, URL, QR, dashboard, settings | PASS | DB "1"; 22b E2E; 22c E2E 1 |
| Associations: create through a parent, invite, approve/reject, verified acceptance, suspend, revoke, remove without deleting, multiple venues/branches, business-controlled hosting | PASS | DB + E2E (matrix rows 2–7, 12) |
| No cycles or invalid hierarchies | PASS | DB "23/25", loop-audit cycle test; 22c E2E 23 |
| Directory: profile, listings, search, filters, detail navigation, book-now, hours, directions, ar/en, SEO, responsive, empty/error states | PASS | 22b E2E; sweep 544 loads |
| Directory loading state | PARTIAL | deliberate — `PHASE_22_OPEN_ISSUES.md` O5 |
| URL + QR + copy/share/download + attribution; separate from booking credentials and gate passes | PASS | 22b E2E (QR byte-equal), attribution DB |
| Booking through an organization page (steps 1–6), source tracked, ownership preserved | PASS | `qa-booking-e2e` (browser, `?org=`), 22b DB "O" |
| Booking step 7 — booking details | PASS (manage link) · check-in QR: Phase 23 | booking-e2e |
| Dashboards for parent owner, org manager, venue manager, business owner, delegated manager | PASS | 22c E2E (delegate in a browser), 22b, Phase 22 venue console |
| Backward-compatible migrations, constraints, transitions | PASS | migration preservation (test 21) |
| Required documents | PASS | report, architecture ×3, acceptance matrix |
| Tests 1–26 | PASS (26 with the O4 note) | `docs/testing/ORGANIZATION_ACCEPTANCE_MATRIX.md` |
| Production verification | NOT TESTED | not deployed (O1) |
| External gate integration | BLOCKED (external) | O8 |

## 2. Implementation verification

Verified end to end, not by component: UI → API → database → the next
request, for owners, delegates, hosting malls, staff tokens and
strangers (22c E2E, 56+ checks; 22b, 83). Permission checks are
server-side on every route (`requireBusinessAccess`, `requireOrgAccess`,
the owner-only `requireBusiness`, the proxy allowlist) and were attacked
directly (403/404/409 assertions), never inferred from hidden buttons.
No fabricated production data: fixtures are labelled QA rows, removed
after each run. No dead controls found in the sweep or E2E. Cache
invalidation: the dashboard reads per request; `router.refresh()` after
acting changes; sitemap revalidates hourly.

## 3. Defects found by this audit

| # | Sev. | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| A1 | P2 | Live booking stream retried forever on permanent failures | Reconnect loop with no attempt bound; EventSource cannot see the status | Bounded reconnection (8 failures; good session = 10 s open; event-driven revival) | `booking-stream.test.ts`; `qa-loops-browser` #2 (old: 80 attempts / 40 sim-min) |
| A2 | P2 | Two live streams per bookings tab (double DB polling) | Header and page each opened their own EventSource | One ref-counted connection per tab | `booking-stream.test.ts`; `qa-loops-browser` #1 (old: 2) |
| A3 | P3 | Acting-banner self-heal could re-attempt on re-render | No attempt guard | One attempt per page; refresh only on success | `qa-loops-browser` #3 |
| A4 | P2 | (re-review) Accepted-then-dropped streams reset the bound | Counter reset on `open` | Reset only after a stable session | "accepted and dropped at once also counts" |
| A5 | P2 | (re-review) Gave up permanently in a persistent layout | No recovery path | Revive on online / visible / new subscriber | "recovery … triggered by events" |
| A6 | P2 | (re-review) One failing subscriber starved the others; `null` payload threw | No per-listener isolation | Isolated delivery; objects only | "delivery" tests |
| A7 | P2 | (re-review) Mobile token refresh could hang forever, freezing every later request | No timeout on the refresh fetch | 15 s abort on refresh + body | "a refresh that hangs…" (old client: watchdog timeout) |
| A8 | P3 | Business rescheduling had no test at all | Coverage gap | Added to 22c E2E (delegate and owner) | 22c "reschedules…" |

Earlier in this phase (before this audit) two independent reviews found
19 defects, including 5 authorization/data-leak bugs — all fixed and
regression-tested (matrix R1–R10).

## 4. Security and permissions

Verified directly (`qa-security` 32/32; 22b and 22c E2E; phase22c DB):
authentication (401 anonymous; expired bearer sessions — qa-phase22; a forged session cookie — the audit's break-it probe, not a committed suite), role-based
authorization, organization permissions (manager vs owner vs platform),
business ownership (owner keeps every power; only the owner grants),
hosting restrictions (DB-enforced), delegated restrictions (exact scopes;
never sign-in access, billing, settings), cross-business and
cross-organization isolation, branch scope (including the `?branchId=`
widening the review found), customer booking ownership, payment access
(owner-only; FINANCE gates money), staff access (no login details, no
sign-in control for delegates; staff tokens cannot read colleagues'
time off), admin access (404 for non-admins), rate limits (member lookups
exercised end to end — the 11th is 429; registration and invite limits
checked only for sane bucket settings by `rate-limit.test.ts`). No secrets or sensitive values are logged by
the changed code (diff scan); no hardcoded credentials. Dependency
advisories: O2 (mobile, P2), O3 (web, P3). Visitor credentials and
provider integrations: Phase 23 — not applicable.

## 5. Database integrity

Migrations are additive and idempotent (applied repeatedly on QA); data
preservation proven by row counts across ten tables around a re-run;
legacy labels mapped; no access granted by migration. Constraints: three
CHECKs, the per-type live index, the whole-business one-owner index, the
hierarchy FK/CHECK/trigger. Cascades: organization deletion cascades its
associations; business deletion cascades its associations; actor ids are
deliberately not FKs. Transactions: association creation and ownership
changes under a per-business advisory lock; conditional updates refuse
races. Indexes support the hot paths (`businessId,status`,
`organizationId,status`, `parentId`). Booking and payment consistency:
unchanged engine; Paymob idempotency tests pass.

## 6. User journeys (Arabic and English where the suite covers both)

| Journey | Coverage | Status |
|---|---|---|
| Customer: registration, login | signup + credentials login in 21/22b/22c; sweep ar/en | PASS |
| Customer: business and organization discovery | booking-e2e URL compatibility, sweep `/businesses`, `/groups` ar/en | PASS |
| Customer: booking, confirmation | booking-e2e (ar/en, phone and desktop) | PASS |
| Customer: cancellation | booking-e2e (manage link) | PASS |
| Customer: self-service rescheduling | unit rules only (`self-service.test.ts`); no end-to-end run | **NOT TESTED** (E2E) |
| Customer: reviews | no end-to-end run in any suite | **NOT TESTED** (E2E) |
| Customer: booking QR / check-in | Phase 23 | NOT APPLICABLE |
| Business: registration, onboarding, dashboard | qa-phase21; sweep | PASS |
| Business: services, staff, bookings, customers, permissions | 22c (owner and delegate), booking-e2e | PASS |
| Business: rescheduling | 22c (added in this audit) | PASS |
| Business: notifications | outbox and cron tests; qa-phase19 | PASS |
| Business: payments (fake Paymob) | qa-phase19, webhook DB tests | PASS (mocked provider — not live validation) |
| Organization: registration, association, ownership, hosting, delegation, invitations, directory, links, QR, analytics, permissions | 22b + 22c | PASS |
| Venue access: booking eligibility, visitor pass, revocation, provider failure | Phase 23 (only venue closure blocking bookings exists — qa-phase22) | NOT APPLICABLE |
| Admin: role enforcement, tenant access, auditing, entitlements | qa-security, 22b/22c, qa-phase21 | PASS |

## 7. Verification commands

See `PHASE_22_REGRESSION_RESULTS.md` (every command, environment, actual
result).

## 8. Release decision

```
PHASE NUMBER:              22 (final — organizations, ownership, hosting, management)
PHASE REQUIREMENTS STATUS: PASS locally for every mandatory requirement; one deliberate PARTIAL
                           (directory loading skeleton, O5); production NOT TESTED (O1)
CODE REVIEW STATUS:        PASS — Phase 22 final: 2 independent reviews (19 findings, all fixed); this
                           audit's fixes re-reviewed once, finite (10 findings, 4 of them defects, all fixed)
BUILD STATUS:              PASS (tsc 0 errors, lint 0 errors / 6 pre-existing warnings, build OK)
UNIT TESTS:                PASS — web 1215 passed, mobile 206 passed
INTEGRATION TESTS:         PASS — Postgres suites included above (organizations 13, booking, outbox, webhook)
E2E TESTS:                 PASS — 22c 59/59, 22b 83/83, 22 68/68, 17/19/20/21, booking 22/22, consoles clean
SECURITY TESTS:            PASS — qa-security 32/32, authorization attacks in 22b/22c; dependency
                           advisories open (O2 mobile P2, O3 web P3)
DATABASE INTEGRITY:        PASS — idempotent additive migrations, preservation proven, DB-level constraints
INFINITE-LOOP AUDIT:       PASS — 2 unbounded behaviours found and fixed (live-stream retries, duplicate
                           streams) + 4 holes in the first fixes; redirects 108/108, browser loops 9/9;
                           no KNOWN or REPRODUCIBLE unbounded loop remains in the reviewed scope
                           (absence of all loops is not claimed)
MEMORY LEAK REVIEW:        PASS — heap flat over 35 navigations; timers/listeners cleaned; one stream per tab
PERFORMANCE REVIEW:        PASS — delegate overhead within run-to-run noise (≤ +17 ms); bookings page polling halved
REGRESSION TESTS:          PASS — every earlier suite green on the final build; sweep 544 loads, 0 flagged
TESTS NOT RUN:             production checks; live Paymob; mobile Maestro E2E; Phase 23 journeys;
                           customer self-service rescheduling and reviews end to end
BUGS FOUND:                8 in this audit (A1–A8: 0 P0, 0 P1, 6 P2, 2 P3)
BUGS FIXED:                8 of 8, each with a regression test (A8 is a coverage gap, now covered)
UNRESOLVED BUGS:           none known in the phase's code; open items O2–O7 (dependencies, test
                           flake, deliberate partial, legal decision, mobile scope)
EXTERNAL BLOCKERS:         gate hardware (Emaar) — external, separate milestone; live payment provider validation
PRODUCTION READINESS:      ready to deploy after the owner runs migrate-phase22c.sh, merges #44 → #45 → #46,
                           and a signed-in production check passes

FINAL VERDICT: PARTIAL
```

**Why PARTIAL and not PASS.** The phase's code passes every mandatory
requirement and every test locally, with no open P0/P1. It is not PASS
because (1) it is not deployed and nothing has been verified on
production, (2) one requirement is a deliberate partial (O5), and (3) two
customer journeys in the audit's list are not covered end to end
(self-service rescheduling, reviews). It becomes PASS after the
production steps in O1 and a signed-in production check.
