# Phase 23 — English for the four screens, and the realtime fix

**Date:** 2026-11-01. **Branch:** `phase-23` (PR #48). **Commits:**
`e62b124` (English), `bcd259a` (first review), `768da9a` (realtime),
`5dc2fbf` (second review); the rest of the booking page in
`22a9d87`, `3063d93`, `0909bbf`, `adc7c87`. **Environment:** local QA only — Docker
Postgres `maw3ed-qa`, production build on :3101 with `ACCESS_SANDBOX=1`,
Chromium via Playwright. **Nothing ran against production.**

Closes P23-A1 (`PHASE_23_OPEN_ISSUES.md`).

## What changed

**Screens.** The four Phase 23 screens follow the visitor's language,
like the rest of the dashboard and the venue console (`useLanguage()`
in client components, `getLang()` in server pages, Arabic default):

| Screen | Files |
|---|---|
| Check-in desk (`/dashboard/check-in`, `/c/<code>`) | `components/access/CheckInDesk.tsx`, `app/dashboard/check-in/page.tsx`, `app/c/[code]/page.tsx` |
| Venue security desk (`/venue-admin/<id>/access`) | `app/venue-admin/[id]/access/_components/AccessDesk.tsx`, `…/access/page.tsx` |
| Booking page: check-in code and visitor passes | `app/booking/[token]/_components/AccessPanel.tsx`, `components/access/PassCard.tsx` |
| Guest pass (`/pass/<token>`) | `app/pass/[inviteToken]/page.tsx` |

Page titles are in the visitor's language. `/c` and `/pass` read
left-to-right in English (they were fixed `dir="rtl"`).

**APIs.** The routes behind these screens answer in English with
`?lang=en` (the contract the app already used for the booking access
API): pass reasons, gate, venue, business, service, staff and provider
names, and their own error messages. `isEnglish`, `localName` (a blank
English name falls back to Arabic) and `refusalText` live in
`src/lib/lang.ts`.

**Also fixed on the way.**
* These screens formatted times with `ar-EG`, which prints Arabic-Indic
  digits (٣:٠٠); `src/lib/fmt.ts` requires Western digits. They now use
  `localeFor(lang)`.
* The guest pass did not fall back to Arabic instructions when a venue
  had no English ones; the holder's view did. Both now use one helper.
* The Arabic schemas' length limits had no Arabic message, so an
  over-long name or note was refused in zod's English. They have Arabic
  messages now.

**Not changed (by design).** Shared pieces — the sign-in and role
guards, the rate limiter, `venues/route.ts handle()` — still answer in
Arabic; the English screens word those refusals by status instead
(`refusalText`).

## The rest of the booking page (later the same day)

Asked for after the above. Commits `22a9d87` (page), `3063d93` and
`adc7c87` (reviews), `0909bbf` (contrast). Closes P23-A8.

* `/booking/<token>` follows the visitor's language: status and its
  message, the details (place, service, staff and branch by their
  English names where they have one; date, duration and money in the
  visitor's language), add to calendar, book again, the cut-off rule,
  changing the time and cancelling. Left to right in English.
* The cancel and reschedule routes answer in Arabic and the app uses
  them too, so the routes are unchanged: the page words their refusals
  from the codes and details they already send (`bookingRefusalEn` in
  `src/lib/lang.ts`), as LeaveReview already did — including the
  cut-off hours, and why a whole day is unavailable (closed, provider
  off, holiday, past, too far ahead).
* **Contrast (found by the sweep).** The pending status, the sandbox
  notices and the pending/suspended pass badges used `--color-star`
  (#D9A441, the rating-star gold) for text on `--color-warn-soft`:
  2.04:1, where WCAG AA needs 4.5:1. `qa-phase18` flagged it on the
  English booking page at all four widths. axe does not flag the same
  Arabic text, but the colours were identical, so both languages had
  it. They now use `--color-warn` (#8A6514), as `.badge-warning` does.
  `qa-phase23-browser` now runs axe's contrast rule on these screens,
  including the pending moment the sweep never sees; on the build
  before the fix those checks fail at 2.04.

## Realtime bookings (Sentry MAW3ED-2)

Sentry reported an "N+1 Query" on `GET /api/realtime/bookings`
(MAW3ED-2, 4 events, 1 user, release `312facd`, production). Cause: the
dashboard's live stream polls every 3 s, and its nested `service`
select ran a second query on every poll — an empty `Service.id IN
(NULL)` when nothing had changed. Fix (`768da9a`, `5dc2fbf`):

* services are read in one query, and only when a poll found changed
  bookings;
* the poll window moves forward only after the poll has read everything
  it sends, so a failed query no longer drops that poll's events (this
  was also true before, for the bookings query);
* one poll at a time, so a slow poll is not overlapped and nothing is
  sent twice.

MAW3ED-1 (the DSN verification event from setup) was resolved in Sentry
at the owner's request. MAW3ED-2 is left open until the fix is deployed.

## Reviews

Four code reviews, each on an explicit range.

| Review | Range | Findings | Fixed | Not taken, and why |
|---|---|---|---|---|
| 1 | `ebd11fa..e62b124` | 10 | 9 | Read the language on the server from the proxy's header instead of `?lang=en`: the app already sends `?lang=en`, and localising the shared guards and rate limiter changes every route in the product — a separate change |
| 2 | `e62b124..768da9a` | 7 | 5 | The same server-side redesign; and removing the screens' own 401 wording — the guards' 401 text is not Arabic, so Arabic screens need it |
| 3 | `e223c67..22a9d87` (booking page) | 8 | 7 | Changing the cancel/reschedule routes to answer in English — the app uses them; the page words them from their codes |
| 4 | `22a9d87..0909bbf` | 7 | 2 (null body; why a day is unavailable) | "The CSP blocks the inline axe script": contradicted by the runs — the check returned real contrast results (2.04 before the fix); the server-side redesign again; three test-script and style nits |

Fixed from review 2 includes the realtime event-loss finding above.

## Results

| Test | Result | Status |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | PASS |
| `npx eslint` | 0 errors, 6 warnings (the same 6 as before; none in changed files) | PASS |
| `next build` | exit 0 (three builds: English, review 1 + realtime, final) | PASS |
| Access tests `src/lib/access` (unit + DB) | 66/66 on the final code: 28 unit + 38 DB (was 24 + 37). New: English refusals; names, blank-name fallback and status wording; field messages; DB "EN" (check-in names, desk names and reasons, guest pass in both languages) | PASS |
| Full suite, final code, run 1 | 1283 passed, **4 failed**, 34 skipped — all four in `bookings/reliability.db.test.ts` (3 timeouts, 1 setup error under contention) | Known flake O4 |
| `reliability.db.test.ts` alone | 13/13, 13/13 | PASS |
| Full suite, final code, run 2 | **1287 passed, 34 skipped, 0 failed** | PASS |
| `qa-phase23-browser` (now 38 checks: 18 Arabic + 20 English) | 38/38 on the first English build, after review 1, and on the final build | PASS |
| English checks in it | each English screen: English words and title, left-to-right, the server's reasons and names in English, no Arabic left beyond Arabic data (names typed in Arabic), Western digits, no console errors, actions (request pass, add guest, verify, hold a pass) confirm in English | PASS |
| `qa-phase23`, `qa-phase23-loops`, `qa-security`, `qa-loops-browser`, `qa-phase22c` | final build: 48/48, 15/15, 32/32, 9/9, 59/59 | PASS |
| `qa-redirects`, `qa-phase22`, `qa-phase22b`, `qa-booking-e2e`, `qa-venue-console` | build after review 1: 108/108, 68/68, 83/83, 22/22, all clean | PASS |
| `qa-phase18` (544 page loads, ar + en, 4 widths, axe) | build after review 1: 544 loads, 0 flagged, 0 axe serious/critical | PASS |
| Realtime stream check (one-off, scratchpad `realtime-check.mjs`): a changed booking reaches an open stream with its service name and duration | final build: 8/8 | PASS |

The detector behind "no Arabic left" was itself checked: it flags an
Arabic sentence and Arabic-Indic digits, and passes Western digits.

### Booking page (final code, `adc7c87`)

| Test | Result | Status |
|---|---|---|
| `npx tsc --noEmit`; `npx eslint`; `next build` | exit 0; 0 errors (the same 6 old warnings); exit 0 | PASS |
| Full suite, run 1 | 1285 passed, **3 failed** (all in `bookings/reliability.db.test.ts`), 34 skipped | Known flake O4 |
| `reliability.db.test.ts` alone, then full suite run 2 | 13/13; **1288 passed, 34 skipped, 0 failed** | PASS |
| `qa-phase23-browser` | 49/49 (7 English booking-page checks, 4 contrast checks) | PASS |
| `qa-booking-e2e` | 22/22 | PASS |
| On the contrast-fix build (`0909bbf`): `qa-phase19`, `qa-phase23`, `qa-phase23-loops`, `qa-security`, `qa-redirects` | 21/21, 48/48, 15/15, 32/32, 108/108 | PASS |
| `qa-phase18` on the contrast-fix build | 544 loads, **0 flagged**, 0 axe serious/critical | PASS |
| `qa-phase18` on the page build before it (`22a9d87`) | 544 loads, **4 flagged**: color-contrast on the English booking page, all four widths | FAIL → fixed in `0909bbf` |

### Failures seen, and what they were

| Seen | Cause | Action |
|---|---|---|
| `qa-phase18` on the first English build: 510 loads, 2 flagged | Both "LOGIN FAILED" for the owner at two widths; the server log shows `[auth] login rate limited` at those times — the battery had signed in as that owner many times | The final battery clears the rate-limit table before each script: 544 loads, 0 flagged |
| Realtime check failed 1 of 1, then 4 of 7, on the final build | Test artifact. The check stamped the booking with the database's `NOW()`; the QA container's clock drifts against the host (measured: +80 ms per 1.5 s, then a jump of −1.4 s), so a booking touched just after the stream opened could be stamped *before* it. The stream compares against the app's clock, as Prisma's `@updatedAt` stamps it | Check stamps with the app's clock, as the app does: 8/8. The underlying clock assumption is recorded as P23-A9 |
| Full suite run 1: 4 failures | O4 (above) | Run 2: 0 failures |
| Booking page: the browser script's first run, 27/29 | Test error: it looked for "Manage booking" on a booking 40 minutes away, inside the salon's 2-hour cut-off, where the page correctly hides it | Change and cancel checked on a booking 200 minutes away: 45/45 |
| A contrast check failed once on the "Add a guest" button (3.39, then 4.09), and once on the desk's buttons (1.67) | Measured mid-transition: the button was fading back from its disabled (busy) look; at rest it is white on #0D7A5A, about 5.4:1 | The check waits for the page to settle: 49/49 twice |

## Not run

| Test | Why |
|---|---|
| Production | Not deployed; owner's action (`PHASE_23_OPEN_ISSUES.md` P23-G1) |
| A real phone camera, real gate provider | As in the Phase 23 audit: fake camera stream, sandbox provider |
| The app in English | The app already sends `?lang=en` to the booking access API; no app code changed |
