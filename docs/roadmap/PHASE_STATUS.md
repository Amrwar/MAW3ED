# Phase status

Four separate claims, never merged into one:

- **Code complete:** merged to `main` with CI green.
- **Staging verified:** exercised on the staging deployment
  (`maw3ed-staging.vercel.app`, fictional data; see `docs/staging.md`).
  It was set up on 2026-11-03, so earlier phases show NOT RUN.
- **Production verified:** checked on maw3ed.net after deploy.
- **Partner verified:** checked with the external party (Paymob,
  Meta/WhatsApp, Apple/Google, Emaar…).

## Programme phases

| Phase | Verdict | Code complete | Staging | Production | Partner | Report |
|---|---|---|---|---|---|---|
| Baseline | PASS (docs + CI fix) | merged 2026-10-29 (#32) | NOT RUN | n/a | n/a | `docs/phases/BASELINE_REPORT.md` |
| 17 | PARTIAL (code complete; P0 fixes live only once the migration is confirmed) | merged 2026-10-29 (#33) | NOT RUN | NOT VERIFIED | n/a | `docs/phases/PHASE_17_REPORT.md` |
| 18 | PASS (code complete, locally verified) | merged 2026-10-29 (#34) | NOT RUN | NOT VERIFIED | n/a | `docs/phases/PHASE_18_REPORT.md` |
| 19 | PASS (code complete, locally verified; production not verified) | merged 2026-10-29 (#35) | NOT RUN | NOT VERIFIED | n/a | `docs/phases/PHASE_19_REPORT.md` |
| 20 | PASS (code complete, locally verified; residual risks with owners in `docs/security/SECURITY_REPORT.md`) | merged 2026-10-29 (#36) | NOT RUN | NOT VERIFIED | n/a | `docs/phases/PHASE_20_REPORT.md` |
| 21 | PASS (code complete, locally verified, live) | merged 2026-10-30 (#39) | NOT RUN | PARTIAL — 2026-10-30: production served `9e025ba`; new public pages 200, unknown help article 404, owner APIs 401 anonymously; signed-in flows not exercised on production | n/a | `docs/phases/PHASE_21_REPORT.md` |
| 22 | PASS (code complete, locally verified, live) | merged 2026-10-31 (#40) | NOT RUN | PARTIAL — 2026-10-31: production served `fa574c2`; `/venues` and `/en/venues` 200 (empty, `noindex`), unknown venue 404, public venues API 200 with an empty list, venue console and owner page redirect to sign-in, console API 401 and admin venues page 404 anonymously, existing pages 200; signed-in venue flows not exercised on production (no venue created yet) | n/a — no operator integration exists or is claimed | `docs/phases/PHASE_22_REPORT.md` |
| 22b | PASS (code complete, locally verified, live) | merged 2026-10-31 (#43) | NOT RUN | PARTIAL — 2026-10-31: production served `a89df6f`; `/groups` and `/en/groups` 200 (empty, `noindex`), unknown organization 404, public groups API 200 with an empty list, `/org-admin` and `/dashboard/organizations` redirect to sign-in, organizations API 401 anonymously, view counter 204, existing pages 200; signed-in organization flows not exercised on production (no organization registered yet) | n/a — no gate integration exists or is claimed | `docs/phases/PHASE_22B_REPORT.md` |
| 22 final | PARTIAL (code complete, locally verified, live; post-phase audit done) — relationship types, delegated management, hierarchy | merged 2026-10-31 (#46); main CI success | NOT RUN | PARTIAL — 2026-10-31: production served `312facd`; `/groups` and `/en/groups` 200, unknown organization 404, public groups API 200 (no organizations yet), `/org-admin`, `/dashboard`, `/dashboard/organizations` redirect to sign-in, organizations, operable, business-organizations and acting APIs 401 anonymously, existing pages 200; signed-in organization and delegation flows not exercised on production (none registered yet) | n/a — no gate integration exists or is claimed | `docs/phases/PHASE_22_REPORT.md` (final section) |
| 23 | PARTIAL (code complete, locally verified, live; E — a real gate provider — BLOCKED on a partner) — booking QR, check-in, visitor passes (sandbox) | merged 2026-11-02 (#48); production migrations `phase23_access_enums.sql` + `phase23_access.sql` applied and verified 2026-11-01 | NOT RUN | PARTIAL — 2026-11-02: production served `1864f7e`; `/`, `/en` and the check-in page `/c/<code>` 200 (new page, Arabic title), unknown pass and booking links 404, live stream 401 anonymously; signed-in check 2026-11-03 (owner-preview test bookings on the owner's unpublished business): the booking page's QR in Arabic and English, the desk lookup, `/c/<code>`, "too early" and the live stream all verified; **the check-in itself was not run** (the timer for its window was stopped by a low-memory reaper and the window passed); both test bookings cancelled | NOT RUN (no gate partner) | `docs/phases/PHASE_23_REPORT.md`, `docs/qa/PHASE_23_*.md` |
| 24 | PASS (local: generic organization readiness, items 1–8) · real pilot NOT LIVE · item 9 (Emaar) BLOCKED | merged 2026-11-03 (#50); production migration `phase24_resources_scope.sql` applied and verified 2026-11-03 | NOT RUN | NOT RUN — nothing created on production (fictional test data, QA only) | BLOCKED (no gate partner, no operator agreement) | `docs/phases/PHASE_24_REPORT.md`, `docs/eterna/*` |
| 24F1 | PASS (offline booking QR and Save QR; 31/31 in Chromium, WebKit, Firefox) | merged 2026-11-03 (#51) | NOT RUN | PARTIAL — 2026-11-03: production served `6aea9b0`; `sw.js` carries the offline-QR code; saving a QR while signed in was not exercised on production | n/a | `docs/qa/PHASE_24_OPEN_ISSUES.md` (P24-F1) |
| 25 | PARTIAL — customer app complete in code and its web build (35/35, 240 unit tests); native builds and device tests BLOCKED on owner accounts | merged 2026-11-03 (#52) | PARTIAL — staging server live 2026-11-03; Android test APK built on EAS 2026-11-04 (build `908ad38a`) against staging; the owner's on-device check is pending; automated Maestro runs need a paid Expo plan | PARTIAL — 2026-11-03: signed-out smoke OK (pages 200, mobile `me` and account export 401); app-link files 404 until `ANDROID_CERT_SHA`/`APPLE_TEAM_ID` are set | BLOCKED (Apple and Google developer accounts) | `docs/phases/PHASE_25_REPORT.md`, `docs/qa/PHASE_25_*` |
| 26 | PASS (local: SEO, Arabic-aware search, organization discovery, booking funnel, analytics fixes) | merged 2026-11-04 (#54); production migration `phase26_search_funnel.sql` applied and verified 2026-11-04 (owner ran `migrate-phase26.sh`) | PASS — staging migrated and deployed 2026-11-05 (search, funnel endpoint) | PARTIAL — 2026-11-04: production served `830e98f`; pages 200, `/demo` noindex, FAQPage, help in the sitemap, funnel endpoint 204, folded Arabic search finds a live business; signed-in reports not exercised | n/a | `docs/phases/PHASE_26_REPORT.md`, `docs/seo/SEO_AUDIT.md`, `docs/analytics/*`, `docs/performance/PERFORMANCE_BASELINE.md` |
| 27 | PASS (local: advanced booking, loyalty ledger, packages and memberships, waitlist, automations, operations report, organization loyalty; multi-service bookings, shared-capacity classes and online package sale NOT BUILT) | merged 2026-11-04 (#57, merge `1370326`); production migrations `phase27_enums.sql` + `phase27_operations.sql` APPLIED and VERIFIED 2026-11-04 (owner ran `migrate-phase27.sh`) | PARTIAL — 2026-11-04: staging migrated (owner ran `migrate-staging27.sh`; VERIFIED) and deployed from `main` (`1370326`); signed-out smoke matches production; signed-in flows not exercised on staging | PARTIAL — 2026-11-04: production served `1370326`; pages 200 in both languages, new dashboard/account pages redirect to sign-in, new business/account APIs and the operations cron 401 without credentials, unknown waitlist link page 200 and its API 404, robots disallows `/booking-waitlist/`; signed-in Phase 27 flows not exercised on production | n/a | `docs/phases/PHASE_27_REPORT.md`, `docs/architecture/{ADVANCED_BOOKING_RULES,LOYALTY_LEDGER,MEMBERSHIPS_AND_PACKAGES}.md`, `docs/testing/PHASE_27_ACCEPTANCE_MATRIX.md` |
| 28 | PASS (local: enterprise API and webhooks, contracts, per-venue provider credentials, health and job runs, two-organization validation 46/46) · real partner validation NOT DONE | branch `phase-28` (not merged); production migration `phase28_enterprise.sql` NOT YET APPLIED (owner runs `migrate-phase28.sh` before the deploy) | PASS — 2026-11-05: staging migrated (VERIFIED), Phase 28 deployed (`697d1e1`), rollback to `c371e47` and promote back rehearsed (5 s each) | NOT RUN | BLOCKED (no real access-provider partner) | `docs/phases/PHASE_28_REPORT.md`, `docs/enterprise/*` |

## Historical phases (merged before this programme)

Recorded from the PR history, not re-verified. "Production verified"
is only marked where the repository holds evidence.

| Ref | PR | Merged | Title | Production verified |
|---|---|---|---|---|
| H17 | #1 | 2026-10-08 | Phase 17 remediation: production blockers | not recorded |
| — | #2–#8 | 2026-10-08/09 | Mobile API, payment validation, QA fixes | Payments: **no** (`docs/payments-verification.md`) |
| H20 | #9 | 2026-10-12 | Responsive, accessibility, journeys | not recorded (`docs/qa-phase20-responsive.md` is local QA) |
| H21–H27 | #10–#16 | 2026-10-13 | Mobile app foundation → customer account | not recorded; app not in stores |
| H28 | #17 | 2026-10-13 | Push notifications | **no**: not verified on a device |
| H29 | #18 | 2026-10-13 | Location and nearby | not recorded |
| H30 | #19 | 2026-10-13 | Mobile payments | **no** (Paymob) |
| — | #20–#22 | 2026-10-13/14 | QA sweep, contact page, app redesign | not recorded |
| H32–H34 | #23–#25 | 2026-10-14 | Business app, deep links, mobile performance | not recorded |
| — | #26 | 2026-10-17 | Release audit fixes and store readiness | not recorded |
| — | #27–#31 | 2026-10-28 | Web audits, dependency update, `/en` URLs, soft cap, annual billing, waitlist | Partly. On 2026-10-28, `https://www.maw3ed.net/api/version` reported commit `77c8649`, and `/en/faq`, `/en/pricing` (with its Yearly option), `/waitlist` and `/categories` returned 200. Nothing that writes data was exercised. **CI failed** on #28–#31 (see below) |

## Production migrations

Applied by the owner by hand. This repository cannot see production, so
these rows record what the owner reports.

| Migration | Needed by | Applied to production |
|---|---|---|
| `add_audit_followups.sql` | PR #31 (live since 2026-10-28) | APPLIED 2026-10-29 (owner ran `migrate-prod.sh`; verified by query) |
| `phase17_booking_integrity.sql` | PR #33 (merged 2026-10-29) | APPLIED 2026-10-29; both overlap constraints present (verified by query) |
| `phase18_email_change.sql` | PR #34 (merged 2026-10-29) | APPLIED 2026-10-29; `User_email_lower_key` present (verified by query) |
| `phase19_reliability.sql` | PR #35 (merged 2026-10-29) | APPLIED 2026-10-29 (verified by query) |
| `phase22_venues.sql` | Phase 22 PR (#40) | APPLIED 2026-10-31 before the deploy (owner ran `migrate-phase22.sh`); VERIFIED by query — every table, enum, index and constraint present, every city has a country |
| `phase21_saas.sql` | Phase 21 PR (#39) | APPLIED 2026-10-30 before the deploy and again after it; both runs VERIFIED by query |
| `phase22c_relationship_enums.sql`, then `phase22c_relationships.sql` | Phase 22 final PR (#46) | APPLIED 2026-10-31 before the merge (owner ran `migrate-phase22c.sh`: both files in order); VERIFIED by query — every enum value, column, index, constraint and trigger present, no legacy relationship labels; production served the pre-#46 code (`f1b7a04`) healthily on the migrated schema (no organizations existed) |
| `phase22b_organizations.sql` | Phase 22b PR (#43) | APPLIED 2026-10-31 before the merge (owner ran `migrate-phase22b.sh`); VERIFIED by query — every table, enum, column, index and constraint present, every organization has a status |
| `phase24_resources_scope.sql` | Phase 24 PR | APPLIED 2026-11-03 before the merge (owner ran `migrate-phase24.sh`); VERIFIED — `DelegationScope` has `RESOURCES` |
| `phase27_enums.sql`, then `phase27_operations.sql` | Phase 27 PR (#57) | APPLIED 2026-11-04 before the merge (owner ran `migrate-phase27.sh`); VERIFIED — 13 tables, PACKAGE/MEMBERSHIP payment kinds, ledger CHECKs and unique keys, plan keys NO ACTION, new columns |
| `phase28_enterprise.sql` | Phase 28 PR | NOT YET APPLIED — `migrate-phase28.sh` prepared; its verify block passes on QA |
| `phase20_security.sql` | Phase 20 PR (#36) | APPLIED 2026-10-29 ahead of the merge (verified by query); `PSEUDONYM_SECRET` set in Vercel (all environments) |
| `prisma/data-fixes/2026-10-27-listing-cleanup.sql` | data only | UNCONFIRMED |
| All earlier files in `prisma/migrations/` | earlier PRs | assumed, not recorded |

## CI on `main`

| Commit | CI | Note |
|---|---|---|
| `778faef` (#27) | success | |
| `f651e1c` (#32), `77dd334` (#33), `29d7ba3` (#34) | success | 2026-10-29 |
| `76434ba` (#28) → `77c8649` (#31) | failure | Unit tests passed (934); the "suite not empty" check read 0 because Vitest 5 writes its JSON report to a file. The CI Build step was skipped. Fixed by the baseline PR |
