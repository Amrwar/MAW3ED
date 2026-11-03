# Phase 24 — post-phase audit

Date: 2026-11-03.

Branch `phase-24`, audited at `6ea7a05`. Phase 24 comprises:

* `ec7b9ef`: phase code;
* `1bf09bc`: review round 1;
* `8f83482`: audit tests;
* `6ea7a05`: review round 2.

The phase under audit is **Phase 24**: organization platform, venue
configuration (Eterna-style, fictional) and pilot validation.

Read for this audit: the Phase 24 prompt, `PHASE_24_REPORT.md`,
`docs/eterna/*`, `ORGANIZATION_PERMISSIONS.md`, the Phase 22 and 23
reports and open issues, and the code of every changed file.

Method:

* The earlier report was not taken on trust. Every requirement below is
  rated from a test that ran, not from the code existing.
* Two independent code reviews:
  * round 1 on `3c3cd4a..ec7b9ef`: 10 findings;
  * round 2 on `ec7b9ef..8f83482`: 8 findings. The first attempt stalled
    and was retried once.
* A final self-review of round 2's fixes.
* The process was fixed in advance: two rounds and a self-review, no
  third round.

## 1. Requirement checklist

| Part | Requirement | Status | Evidence |
|---|---|---|---|
| 1A | Restaurant group: central management, individual operations, booking separation, staff and resource management, aggregated reporting, permissions | **PASS** | `qa-phase24` A, 28/28. Resource management and aggregated reporting were missing and were built in this phase |
| 1B | Mall: invitations, approval, directory, search and categories, public URL, QR, booking through tenants, privacy-safe reporting, no tenant data access | **PASS** | B, 25/25; browser journey |
| 1C | Clinic group: branch permissions, provider scheduling, booking policies, organization management, restricted customer information, sensitive data | **PASS** | C, 12/12; desk privacy in 6.3 |
| 1D | Delegated company: scoped, immediate revocation, no escalation, audit | **PASS** | D, 12/12; DB audit test (revocation of tables) |
| 2 | Eterna configuration (fictional, labelled) | **PASS** | B and P2; no real data (owner's decision) |
| 3.1–3.12 | Customer journey | **PASS** | HTTP 27/27; browser ar/en |
| 4 | 17 exceptions | **PASS** for 16, **PARTIAL** for "customer without internet" (P24-F1) | Part 4, 29/29; browser offline |
| 5 | Load, documented targets, no endless retries | **PARTIAL** | 13/13 in two of three runs. One audit run missed 3 latency targets with correctness intact (P24-P1). Retry termination PASS |
| 6 | End-to-end security | **PASS** | 6, 14/14, plus the audit's direct tests on the tables API |
| 7 | Real Emaar integration | **BLOCKED (external)** | `PARTNER_INTEGRATION_STATUS.md` |
| 8 | Operations: onboarding, training, escalation, incidents, monitoring, rollback, metrics | **PASS** (written; not yet used by anyone) | `LAUNCH_READINESS.md`, `PILOT_PLAN.md` |
| 9 | Final tests | **PARTIAL** | Suites pass on the final code. The final build is not served, so its browser checks, sweep and part of the battery did not run (P24-G1) |
| Docs | The five required documents | **PASS** | Present |

## 2. Implementation verification (changed features)

| Feature | Front ↔ back | Persistence | Permissions | ar/en | Mobile width | Empty, loading, error | Status |
|---|---|---|---|---|---|---|---|
| Group portfolio | Console section → `GET /portfolio` | Read-only (counts) | `org.metrics`; owners of brands 404; anonymous 401; suspended organization: no rows | Both (browser) | 375 and 1440 swept on B2 | Empty: no section. Not approved: an explanation. Failed: notice and Try again. Loading: the section appears when ready | PASS on B2; round-2 UI pending (P24-G1) |
| RESOURCES scope | Grant UI (shared scope list) → association rows → resources API and page, delegate nav | Enum value; CHECK constraints | Owner, or an organization with RESOURCES; staff 403; another business's table 404 | Labels in both | Swept | Pre-existing page states | PASS |
| Scope validator | Uses the shared list | — | — | — | — | — | PASS |
| Metrics names | English names, grouped by business | — | — | — | — | — | PASS |

There are no dead controls in the new UI. "Try again" reloads the
portfolio, and the table is read-only. No fabricated production data:
everything was on QA, fictional, and removed after each run.

## 3. Defects found and fixed

| # | Sev. | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| G1 | P1 (requirement) | A group had no report across its businesses | Not built in Phase 22 | Portfolio | DB 10/10; A10 |
| G2 | P1 (requirement) | A restaurant group could not manage tables at all | Resources were owner-only, and no scope covered them | `RESOURCES` scope and migration | A7 checks; DB audit; unit test |
| G3 | P2 | A grant with RESOURCES was refused (422) | The validator had its own copy of the scope list | Uses `DELEGATION_SCOPES` | A3 |
| G4 | P3 | Console visit counts showed Arabic names in English, and merged businesses that share a name | Grouped by `nameAr` | Grouped by id, both names | Browser sweep |
| R1-1 | P2 | The portfolio counted abandoned checkouts and left cancelled out of the total | Its own copy of the counting rules | Built on `stats.ts` (`ABANDONED`, `LIVE_STATUSES`) | DB test (abandoned and failed payment excluded) |
| R1-2 | P2 | "Upcoming" meant live bookings inside a past window | Window applied to upcoming | Upcoming counts live bookings ahead of now | DB test (tomorrow's booking); A10 made clock-independent |
| R1-4/10 | P3 | Rows blamed owners for not sharing in cases they could not (branch only, suspended organization) | One message for every case | `notShared` reason; a suspended organization gets no rows | DB tests |
| R1-5 | P3 | A business with two relationships appeared twice | Rows per relationship | One row per business | DB test |
| R1-6 | P3 | Silent truncation at 500 | No flag | `truncated` shown | DB test |
| R1-8 | P2 (loop-class) | The portfolio was re-aggregated on every page change and action | Fetched inside `load()` | Its own effect | Browser request count |
| R1-9 | P3 | O(n·m) rescans | Filtering per row | Map by business | Load 5.7 |
| R2-1 | P2 | After R1-8, the portfolio was never refreshed, and a failure was silent | Over-correction of R1-8 | Re-read after successful actions; failure notice with one Try again | Browser checks, **pending** on B3 |
| R2-2 | P3 | Live rows without `startsAt` were missing from upcoming | Filter on `startsAt` only | OR on `date` (as `startInstant`) | DB test |
| R2-3 | P2 | The limit cut relationships, not businesses, which could hide the sharing one | `take` on relationships | `distinct` businesses first | DB test (would have failed on the old code) |
| R2-5 | P3 | A non-approved organization's section vanished without a word | — | Explanation shown | Browser **pending** |
| R2-6 | P3 | Upcoming sat under the window heading | Labelling | "Upcoming (any date)" | — |
| R2-7 | P3 | The browser test toggled publish without checking it was restored | Test gap | Asserts the final state | Browser **pending** |
| R2-8 | P3 | Array copying per relationship | — | `push` | — |
| QA | — | A placeholder check that always passed; three weak checks (pass after completion, pass after reschedule, desk privacy had no clinic visitor) | Test quality | Real assertions (gate attempts; a clinic visitor with a pass) | Themselves |

**Not fixed, by decision:**

* R1-3, the acting-tab contract (P24-R3);
* R2-4, the wording for mixed relationships, which is correct (P24-R4).

## 4. Security and permissions

Verified directly, never through hidden controls:

* organization roles (manager vs owner);
* business isolation;
* branch scope;
* hosted venues having no access;
* delegated scopes and immediate revocation;
* no escalation by forged cookie or by self-granting;
* clinic discretion at the security desk;
* visitor credentials refused for cancelled, unknown or unadmitted
  bookings;
* cross-venue refusal;
* platform-only roles and provider choice;
* staff tokens refused after access is removed;
* the tables API attacked by id, signed out, and with a staff token;
* `qa-security` 32/32.

Rate limits are unchanged and were honoured by the load test, which
spreads customers across addresses. No secrets are logged.

## 5. Database integrity

* The migration is additive and idempotent (run twice in the tests).
* The existing CHECK constraints extend to the new value (DB test).
* The portfolio is read-only.
* No production data was touched.
* The QA data each script created was removed by its teardown.

## 6. Journeys (ar/en)

| Area | Steps | Result |
|---|---|---|
| Customer | Signs in, discovers through the organization, books, is confirmed, opens the QR, asks for a pass, checks in, completes, receives the follow-up, reviews. Reschedule and cancel are covered in Part 4 | PASS (HTTP; browser in Arabic and English) |
| Business | Registers, onboards, publishes, sets up services, staff and tables, handles bookings, grants and withdraws permissions | PASS |
| Organization | Registers, is approved, publishes; invites, hosts, owns and manages businesses; directory, link and QR; metrics and the portfolio | PASS |
| Venue access | Eligibility, pass states, revocation, provider failure | PASS (sandbox) |
| Admin | Approves organizations, creates venues, assigns roles, picks the provider | PASS |

## 7. Release decision

| | |
|---|---|
| PHASE NUMBER | 24 |
| PHASE REQUIREMENTS STATUS | 1A–1D, 2, 3, 6, 8 PASS. 4 PASS except offline reload (PARTIAL, P2). 5 PARTIAL (latency variance). 7 BLOCKED (external). 9 PARTIAL |
| CODE REVIEW STATUS | Two independent rounds (10 + 8 findings) and a self-review. 16 fixed, 2 not fixed by documented decision, 0 open defects |
| BUILD STATUS | `next build` PASS on B1 and B2. B3 not rebuilt (memory); tsc and lint clean on B3 |
| UNIT TESTS | 1311 passed, 0 failed; mobile 206 passed |
| INTEGRATION TESTS | DB suites pass, including Phase 24 10/10 |
| E2E TESTS | `qa-phase24` 147/147 and browser 22/22 on B2. The browser checks of round 2 are NOT RUN on B3 |
| SECURITY TESTS | PASS (`qa-security` 32/32, Phase 24 part 6 and audit checks) |
| DATABASE INTEGRITY | PASS |
| INFINITE-LOOP AUDIT | No known or reproducible unbounded loop. One request-repetition defect (R1-8) found and fixed. `PHASE_24_LOOP_AUDIT.md` |
| MEMORY LEAK REVIEW | No leak found in the changed code. The QA machine's memory pressure comes from other processes |
| PERFORMANCE REVIEW | PARTIAL: local targets met in 2 of 3 runs; the directory page varied (P24-P1). Not a production claim |
| REGRESSION TESTS | 15 earlier QA scripts pass on B1. On B2, 5 were rerun before memory stopped the battery, all passing. 9 were not reached, and the site-wide sweep was not run |
| TESTS NOT RUN | B3 browser checks; `qa-phase18` sweep; 9 regression scripts on B2/B3; production verification; real gate |
| BUGS FOUND | 23: 4 phase gaps, 18 review findings, 1 placeholder test |
| BUGS FIXED | 21: 4 gaps, 16 review findings, the test |
| UNRESOLVED BUGS | None open as defects. Two not fixed by decision (P24-R3, P24-R4) |
| EXTERNAL BLOCKERS | Real gate partner (P24-E); real operator for a pilot (P24-L) |
| PRODUCTION READINESS | Not merged. Needs P24-G1 (serve B3 and finish the runs), then P24-G2 (migration), then merge |

**FINAL VERDICT: PARTIAL.**

Every mandatory requirement is implemented and passes on B2, and no P0 or
P1 defect is open. The verdict is not PASS for three reasons:

* the final code's browser checks, the site-wide sweep and part of the
  regression battery could not run (the QA machine ran out of memory);
* one load run missed latency targets;
* offline reload remains a P2 pilot finding.

The real gate integration is BLOCKED and reported separately. The pilot
is not live.

### Exact next actions

1. **Owner:** free memory by closing spare Chrome windows, and approve
   restarting the QA server.
2. **Engineering:** run the scratchpad helpers, which rebuild and rerun:
   * `qa24-server.sh`;
   * `qa24-regress.sh`, which covers the battery and `qa-phase18`;
   * `qa-phase24.mjs` and `qa-phase24-browser.mjs` on B3.

   Then update this file and `PHASE_24_REGRESSION_RESULTS.md`.
3. **Owner:** run `migrate-phase24.sh` (expect `VERIFIED`), then merge.
4. **Optional:** measure the directory page on a Vercel preview (P24-P1).

Phase 25 is not started.
