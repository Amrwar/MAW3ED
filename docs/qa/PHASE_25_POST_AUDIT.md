# Phase 25 — post-phase audit

Date: 2026-11-03.

Branch `phase-25`, audited at `55e3bfb` plus the audit's own test fix.
Phase 25 comprises:

* `dec776f`: phase code (customer app);
* `8b56dea`: release preparation and report;
* `bc29d46`: merge of PR #51 (offline QR, which the owner asked for
  first);
* `7a1167e`: review round 1;
* `55e3bfb`: review round 2.

The phase under audit is **Phase 25**: production Android and iOS
customer app.

Read for this audit:

* the Phase 25 prompt and `PHASE_25_REPORT.md`;
* `docs/mobile-release.md`, `docs/deep-links.md` and `docs/store/listing.md`;
* the Phase 24 audit and open issues;
* the code of every changed file.

Method:

* The earlier report was not taken on trust. Every rating comes from a
  test that ran.
* Two independent code reviews:
  * round 1 on `3a64586..8b56dea`: 10 findings;
  * round 2 on `8b56dea..7a1167e`: 9 findings.
* A final self-review of round 2's fixes. This was fixed in advance:
  two rounds and a self-review.

## 1. Requirement checklist

| Part | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Inspect before building | **PASS** | `PHASE_25_REPORT.md`, "Inspection first" |
| 2 | Arabic RTL / English LTR, accessibility, states, no loops | **PASS (app web build)**; screen reader on devices NOT RUN | `qa-phase25-app` 35/35; `PHASE_25_LOOP_AUDIT.md` |
| 3 | Account, profile, privacy, support, data export, deletion | **PASS** (new parts); existing parts EXISTING | App E2E; unit tests |
| 4 | Organizations and venues, directory, attribution | **PASS** | App E2E: a booking through the mall is credited to it |
| 5 | Booking QR, visitor passes, no fake gate pass | **PASS** | App E2E pending → active; unit tests |
| 6 | Sessions: restore, sign-out, secure storage | **PASS** in code and the app web build; keychain on a real OS NOT RUN | Unit (re-check, ordering); app E2E |
| 7 | Network resilience | **PASS** | App E2E offline, cold start without an answer, back online |
| 8 | Deep links | **PASS (unit + web build)**; OS app links NOT RUN | `links.test.ts`; `app-links.test.ts` equality guard |
| 9 | Release: builds, stores | **BLOCKED** (owner accounts) | `docs/mobile-release.md` |
| — | Offline QR (owner's prerequisite) | **PASS** | `qa-offline-qr` 31/31 in three engines, on this branch |

## 2. Implementation verification (changed features)

| Feature | App ↔ server | Persistence | Permissions | ar/en | Width | Empty, loading, error | Status |
|---|---|---|---|---|---|---|---|
| Places, org and venue pages | Public directory endpoints | Query cache (public, persisted) | Public data only | Both | Phone, no sideways scroll | Skeleton, not found, error with retry, empty directory | PASS |
| Org attribution | `org` on the booking request | Booking attribution row | Validated slug, ≤ 60 | — | — | A bad `org` is dropped, never fails the booking | PASS |
| Booking access section | Booking access endpoints | Server | Booking token | Both | Phone | Waiting, active, failed, "check again" | PASS |
| Guest pass screen | `/api/pass/<token>` | Server | Only that guest's pass | Both | Phone | Not found, loading | PASS |
| Session restore and re-check | `/api/auth/mobile/me` | Secure store (ordered) | Server decides | — | — | Offline shows the last confirmed account | PASS |
| Data export | `/api/account/export` | Cache until the next export or sign-out | Own account | Both | — | Unavailable sharing reported | PASS |
| Support | Links | — | — | Both | Phone | — | PASS |

There are no dead controls in the new screens, and no fabricated data.
All test data was on QA, fictional, and removed by each script.

## 3. Defects found and fixed

| # | Sev. | Defect | Fix | Regression test |
|---|---|---|---|---|
| P1 (phase) | P1 | A cold start without a connection signed the customer out | `restoreSession` keeps the sign-in unless the server refused it | `restore.test.ts`; app E2E |
| P2 (phase) | P2 | Drafts, unfinished payments and searches survived sign-out | `forgetLocalData` | `local-data.test.ts` |
| P3 (phase) | P3 | Booking poll refetched twice on foreground | Duplicate removed | — |
| Rel (phase) | P1 (release) | The `e2e` build pointed at production | Standalone profile, no production URL | Config |
| R1-1 | P2 | A re-check answer arriving after a sign-in or sign-out applied to the wrong session | Epoch: stale answers dropped | Unit |
| R1-2 | P2 (loop) | Polling counted only answers; a failing server was asked forever | Failures count | Unit; app E2E |
| R1-3 | P2 | App org-slug check looser than the server's limit, so a long `org` could fail a booking | `ORG_SLUG` ≤ 60 (refined in R2-7) | Unit |
| R1-4 | P2 (privacy) | The data export stayed in the cache forever | Removed before the next export and on sign-out (refined in R2-1) | `export.test.ts` |
| R1-5 | P3 | Guest link shared with a bare `Share` (no copy fallback, no toast) | `shareLink` | — |
| R1-6 | P3 | One failed re-check waited for the next connection change | 5 s, 30 s, 120 s retries | Unit |
| R1-7 | P3 | Guest limit counted differently from the server | `guests.length < guestLimit`, as the server counts | — |
| R1-8 | P3 | Slug and token rules duplicated | One copy in `lib/links.ts` | — |
| R1-9 | P3 | Places lists not persisted for offline | Added to the persisted public data | — |
| R1-10 | P3 (dev tool) | `app-web-serve` path guard used `startsWith` | `path.relative` | Traversal probe |
| R2-1 | P2 | The export was deleted before the receiving app could read it | Kept until the next export or sign-out | `export.test.ts` |
| R2-2 | P2 | A refused session's token clear could interleave with a new sign-in's writes | Token store runs operations one at a time, in call order | Unit (re-check) |
| R2-3 | P3 (privacy) | A late `rememberUser` could outlive a sign-out | Same ordering, plus a stale check | — |
| R2-4 | P3 | A failing token clear escaped as an unhandled rejection | Caught | Unit |
| R2-5 | P3 (test) | The E2E re-check count depended on timing | Counts from before the block lifts, plus a quiet window | App E2E |
| R2-7 | P2 | `ORG_SLUG` (R1-3) rejected older organizations' slugs | ≤ 60, old character set | Unit |
| R2-9 | P3 | Detached doc comment | Moved | — |
| A3 (audit) | P3 (test) | `qa-phase24` 3.10 "too early" was skipped when the slot was near | Always moves the booking an hour ahead | `qa-phase24` 147/147 |

**Not fixed, by decision:** R2-6 and R2-8 (`PHASE_25_OPEN_ISSUES.md`,
P25-R6 and P25-R8).

## 4. Security and privacy

* Tokens live only in the secure store (Keychain or EncryptedSharedPreferences).
  The browser preview uses sessionStorage outside production; a
  production web build stores none.
* Only a server refusal signs out, and tokens are then cleared in order.
* Sign-out forgets local personal data, the last account and data
  exports.
* A guest's pass screen shows only that guest's pass.
* Venue staff see no customer personal data: unchanged server rules,
  re-run by `qa-phase24` part 6, `qa-phase23` and `qa-security` 32/32.
* Deep links validate every slug and token; hostile input is unit-tested.
* The local web server accepts local API targets only, and its path guard
  was probed.
* No secrets in the app bundle or the logs.

## 5. Database integrity

Phase 25 adds no migration. Bookings made from the app write the same
rows as the website (attribution included). Every QA script removed what
it created. Production was not touched.

## 6. Journeys (ar/en)

| Area | Steps | Result |
|---|---|---|
| Customer (app) | Discover → organization → section → business → book (credited) → QR → pass → guest → guest's pass; offline; session; support; export | PASS (app web build, both languages) |
| Customer (web) | Booking end to end, offline booking page, Save QR | PASS |
| Business, organization, venue, admin | Phase 22–24 suites | PASS |

## 7. Release decision

| | |
|---|---|
| PHASE NUMBER | 25 |
| PHASE REQUIREMENTS STATUS | Parts 1–8 PASS in code, unit tests and the app's web build. Device-only aspects NOT RUN. Part 9 (release builds, stores) BLOCKED on owner accounts |
| CODE REVIEW STATUS | Two independent rounds (10 + 9 findings) and a self-review. 17 fixed, 2 not fixed by documented decision, 0 open defects |
| BUILD STATUS | `next build` PASS; `expo export --platform web` PASS; `expo-doctor` 21/21. Native builds NOT BUILT (P25-B1) |
| UNIT TESTS | Web 1319 passed (DB suites included), 0 failed. Mobile 240 passed, 0 failed |
| INTEGRATION TESTS | DB suites pass |
| E2E TESTS | App 35/35; offline QR 31/31; booking 22/22; Phase 24 147/147 and browser 23/23; Phase 23 48/48, 49/49, loops 15/15 |
| SECURITY TESTS | PASS (`qa-security` 32/32; Phase 24 part 6; link and path probes) |
| DATABASE INTEGRITY | PASS (no migration; cleanup verified by each script) |
| INFINITE-LOOP AUDIT | No known or reproducible unbounded loop; two found and fixed (L1, L2). `PHASE_25_LOOP_AUDIT.md` |
| MEMORY LEAK REVIEW | Effects and subscriptions in the changed code are cleaned up (re-check stops its timer and listener; polling stops). No leak found. The QA machine's own memory pressure crashed one sweep's browser (re-run clean) |
| PERFORMANCE REVIEW | No new heavy path. App lists are memoized; polling is bounded. Device performance NOT RUN |
| REGRESSION TESTS | All earlier QA scripts and the site sweep (owner 144, admin 72, anonymous 224 loads, 0 flagged) PASS |
| TESTS NOT RUN | Native builds, device/emulator tests, OS share sheet, push, app links, keychain, screen readers (P25-B1) |
| BUGS FOUND | 23: 4 found by the phase's inspection, 19 review findings, plus 1 skipped test check found by the audit |
| BUGS FIXED | 22: the 4 phase defects, 17 review findings, and the test check |
| UNRESOLVED BUGS | None open as defects. Two not fixed by decision (P25-R6, P25-R8) |
| EXTERNAL BLOCKERS | Owner accounts for EAS, Apple and Google; a non-production test backend; P24-E and P24-L unchanged |
| PRODUCTION READINESS | The web changes (offline QR and the shared links list) are ready to merge: #51 first, then the Phase 25 PR. The app is ready for its first EAS builds, not for store submission |

**FINAL VERDICT: PARTIAL.**

Everything that can be built and tested here is built and passes:

* the app's code, unit tests and its own web build against the QA server;
* the web regression battery on the combined branch.

No P0 or P1 defect is open. The verdict is not PASS because the
phase's goal is a *production Android and iOS app*, and no native build
or device test exists yet. That is BLOCKED on the owner's accounts, not
on code.

### Exact next actions

1. **Owner:** merge PR #51 (offline QR), then the Phase 25 PR.
2. **Owner:** `! npx eas-cli login`, then follow `docs/mobile-release.md`
   (EAS cloud builds, the option chosen). Provide a non-production test
   backend URL for the `e2e` profile.
3. **After the first signed build:** set `ANDROID_CERT_SHA` and
   `APPLE_TEAM_ID` in Vercel, then run the device checklist in
   `docs/mobile-release.md`.

Phase 26 is not started.
