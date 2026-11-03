# Phase 25 report: production Android and iOS customer app

Date: 2026-11-03. Branch `phase-25`, from `main` at `3a64586` (Phase 24,
live).

## Inspection first (Part 1)

The app already existed and was substantial. An inventory of `mobile/`
against every Phase 25 requirement came first: about 180 tests, Maestro
flows, secure token storage, idempotent booking, and offline handling for
discovery. It was extended, not replaced.

What it was missing:
- organizations and venues, entirely;
- booking QR and visitor passes, entirely;
- `org` attribution on bookings;
- `/groups`, `/venues` and `/pass` links;
- customer support.

Bugs it had:
- **(P1)** a cold start without a connection signed the customer out and
  threw away a valid refresh token;
- **(P2)** booking drafts, unfinished payments and searches survived
  sign-out;
- **(P3)** the booking poll refetched twice on foreground.

Release finding: the `e2e` build pointed at production.

No backend rules were duplicated: every new screen calls the website's own
endpoints, and the app decides no state itself.

## What was built

| Area | Change |
|---|---|
| Organizations and venues (Part 4) | `app/places.tsx` (malls & groups / venues, search). `app/org/[slug].tsx`: profile, share, parent/children, venues, a directory with the organization's sections, category chips and search. `app/venue/[slug].tsx`: floors, hours, directions, directory. A home entry is shown only when one exists |
| Attribution | Opening a business from a directory carries `org` (validated slug). The booking request sends it, so the server credits the organization, as the website's `?org=` does. It is part of the idempotency fingerprint |
| Booking QR and passes (Part 5) | `features/access/AccessSection.tsx` on the booking screen: the check-in QR (the server's SVG), a new code, and visitor passes (request, guests, links, retry). A pass shows a code only once the venue's access system confirmed it; a sandbox pass says it opens no real gate. `app/pass/[token].tsx`: a guest's own pass |
| Deep links | `/groups/<slug>(?src=qr)`, `/venues/<slug>`, `/pass/<token>`, `/company/<slug>?org=`, `/contact`, `/help`. Android intent filters and the iOS association extended together, with a test that they match. `/c/<code>` (the front desk) stays on the web |
| Sessions (Part 6) | `features/auth/restore.ts`: only a server that ended the session signs out. The last confirmed account is remembered in the secure store and re-checked when back online. Sign-out and account deletion forget local personal data |
| Network (Part 7) | Pass polling bounded (10 × 4 s, then "check again"). Offline keeps the codes on screen and stops asking. Existing: idempotent booking retries, timeouts, an offline banner |
| Support and privacy (Part 3) | `app/support.tsx`; "Download a copy of my data" (`GET /api/account/export`, share sheet or download) |
| Release (Part 9) | `docs/mobile-release.md`. Expo packages aligned (doctor 21/21). The `e2e` profile no longer points at production and stops without a test backend. Store privacy answers updated |
| Libraries | `react-native-svg`, `expo-file-system`, `expo-sharing`: Expo SDK 57 versions, standard native modules |

## Requirements (Parts 2–5)

Legend:
- **PASS (app):** verified in the app's own web build against the QA
  server (`qa-phase25-app.mjs`).
- **PASS (unit):** unit-tested only.
- **EXISTING:** present before this phase, with its earlier tests; not
  re-verified on a device here.
- Device runs are reported separately: **NOT RUN** for both platforms (see
  "Platforms").

| Requirement | Status |
|---|---|
| Arabic RTL / English LTR | PASS (app), both languages, no sideways scrolling |
| Accessible controls | PASS (app): labelled QR images, roles on chips and tabs. A screen-reader pass on devices: NOT RUN |
| Loading, error and empty states | PASS (app): not found, a dead link, skeletons, error with retry |
| No repeated navigation, flicker or loops | PASS (app): polling bound, no requests offline, a not-found ends cleanly |
| Registration, login/logout, recovery | EXISTING (phone code; owners by password). Session restore PASS (unit + app) |
| Profile, settings, privacy controls | EXISTING; data export added, PASS (app) |
| Home, categories, search, business pages, services, staff, calendar, restaurant tables | EXISTING; the booking flow walked end to end, PASS (app) |
| Booking confirmation | PASS (app) |
| Upcoming, history, cancellation, rescheduling, saved, reviews, notifications | EXISTING (unit tests and Maestro flows); not re-run on a device |
| Account deletion | EXISTING; now also forgets local data, PASS (unit) |
| Support | PASS (app) |
| Organization pages, child businesses, category filter | PASS (app) |
| Book within an organization, attribution kept | PASS (app): the attribution row is written for the mall |
| Organization links, share, directory QR links | PASS (app, link routing unit-tested); the share sheet needs a device |
| Booking QR, check-in information | PASS (app) |
| Visitor pass status, guests, expiry and revocation states | PASS (app + unit): pending → active from the sandbox; guests; state labels for every server state |
| No fake gate pass | PASS: a code only once the access system confirmed; sandbox labelled |
| Deep links | PASS (unit, 18 tests incl. hostile input) and PASS (app: `/org`, `/venue`, `/pass`) |

## Tests

| Command | Result |
|---|---|
| `cd mobile && npx tsc --noEmit` | 0 errors |
| `cd mobile && npx eslint .` | 0 problems |
| `cd mobile && npx vitest run` | **231 passed**, 10 skipped (new: restore 6, local data 2, access 6, places 5, links +4, booking flow +1) |
| `npx expo-doctor` | 21/21 |
| `node scripts/qa-phase25-app.mjs` | **34/34**. The app's own web build against the QA server: discovery → organization → section → business → booking through the app's flow, credited to the mall; check-in QR; a pass from pending to active; a guest with a link; the guest's pass; QR visit counted; venue; not-found; offline (codes stay, no requests); cold start with no answer keeps the sign-in; an ended session signs out and clears the tokens; the polling bound and "check again"; support; data export; English; no sideways scrolling |
| Web `src/lib/app-links.test.ts` | 5/5, including the iOS/Android path equality guard |

## Platforms (reported separately)

| | Android | iOS |
|---|---|---|
| Code, configuration, tests above | Ready | Ready |
| Release build | **NOT BUILT** — needs the owner's Expo sign-in | **NOT BUILT** — needs the Expo sign-in and an Apple Developer account |
| Device / emulator functional tests | **NOT RUN** — no SDK or emulator here; Maestro on EAS needs a test backend | **NOT RUN** — no Mac; TestFlight |
| Push, app links, share sheet, keychain, background/foreground on a real OS | **NOT RUN** | **NOT RUN** |
| Store approval | Not submitted | Not submitted |

Exact steps: `docs/mobile-release.md`, "What the owner has to do".

## Verdict

**PARTIAL.** The customer app is complete in code, and verified in the
app's own build in a browser (34/34) and by unit tests (231). Android and
iOS release builds and device tests are **BLOCKED** on the owner's
accounts (Expo, Apple, Google) and a non-production test backend.
Nothing is submitted or approved.

Phase 26 is not started.
