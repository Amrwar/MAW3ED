# Phase status

Four separate claims, never merged into one:

- **Code complete:** merged to `main` with CI green.
- **Staging verified:** exercised on a staging deployment. *There is no
  staging environment yet, so this is NOT RUN for everything.*
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
| 22 final | PARTIAL (code complete, locally verified; not deployed) — relationship types, delegated management, hierarchy | PR open (`phase-22-final`) | NOT RUN | NOT VERIFIED — needs both `phase22c_*.sql` files before the deploy | n/a — no gate integration exists or is claimed | `docs/phases/PHASE_22_REPORT.md` (final section) |
| 23–28 | NOT STARTED (23–24 rescoped: `docs/roadmap/UPDATED_PHASES_22_24.md`) | — | — | — | — | — |

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
| `phase20_security.sql` | Phase 20 PR (#36) | APPLIED 2026-10-29 ahead of the merge (verified by query); `PSEUDONYM_SECRET` set in Vercel (all environments) |
| `prisma/data-fixes/2026-10-27-listing-cleanup.sql` | data only | UNCONFIRMED |
| All earlier files in `prisma/migrations/` | earlier PRs | assumed, not recorded |

## CI on `main`

| Commit | CI | Note |
|---|---|---|
| `778faef` (#27) | success | |
| `f651e1c` (#32), `77dd334` (#33), `29d7ba3` (#34) | success | 2026-10-29 |
| `76434ba` (#28) → `77c8649` (#31) | failure | Unit tests passed (934); the "suite not empty" check read 0 because Vitest 5 writes its JSON report to a file. The CI Build step was skipped. Fixed by the baseline PR |
