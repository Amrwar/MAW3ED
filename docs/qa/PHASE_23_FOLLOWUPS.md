# Phase 23 follow-ups — P23-A5, P23-A9, P23-A10 (and P23-O1 revised)

**Date:** 2026-11-02. **Branch:** `phase-23-followups` (from `main` at
`a85d348`, after #48 and #47). **Decided by the owner:** "go with your
recommendations". **Environment:** local QA only — Docker Postgres
`maw3ed-qa`, production build on :3101, Chromium via Playwright.
**Nothing ran against production.**

## P23-A5 — a discreet business is not named on the security desk

A venue's security desk saw which business each visitor was going to; for
a clinic that tells the venue's staff something about the visitor's
health.

* `Business.accessDiscreet` (nullable; migration
  `prisma/migrations/phase23_access_discreet.sql`). Null means the
  category's default: **discreet for medical categories** — clinics,
  dentists, labs, and their subcategories (`src/lib/access/discreet.ts`).
* The desk (`src/lib/access/venue-desk.ts`) shows "Not shown (private)" /
  "مش ظاهر (خصوصية)" in place of a discreet business's name. Everything
  else on the row — who, when, which gates, the state — is unchanged.
* The owner's switch is in Settings → Availability, next to auto-confirm
  (`DiscreetSetting.tsx`), saved through `/api/business/settings/booking`
  (owner only), which also answers the category's default. Once the owner
  has chosen, a "use the default for your category" link puts it back to
  null, so a later change of category is followed again.
* Known limit: which categories are medical is a list in code
  (`DISCREET_CATEGORY_SLUGS`), one parent level deep. A new medical
  category (a pharmacy, physiotherapy) must be added to it, or its
  businesses default to named. A `sensitive` flag on Category would make
  it data; not done here.
* The gate provider never received the business (its `PassRequest` has
  no business field), so the desk was the only place it showed.

**Production:** run `migrate-phase23-discreet.sh` (scratchpad) before
this branch deploys. The column is nullable and additive: no row is
written, and nothing changes until the code ships.

## P23-A9 and P23-A10 — the live stream

The dashboard's live stream compared `updatedAt` with the last poll using
each server's own clock (a change stamped by a slower clock could be
missed — A9), and the platform cut every stream at 5 minutes, mid-poll,
with nothing to resume from (A10). The design now
(`src/app/api/realtime/bookings/route.ts`,
`src/lib/realtime/booking-stream.ts`):

**Nothing is dropped.**

* Every poll re-reads the 5 s before the last one (`OVERLAP_MS`), the
  first poll included, so a change made between the page loading and the
  stream connecting, or stamped by a slower clock, is read. A change
  already sent at the same `updatedAt` is skipped: per stream on the
  server, and across streams and pages in the browser (events carry
  `updatedAt`).
* The stream ends itself at 4 min 40 s (`maxDuration = 300`), sends a
  `checkpoint` with each heartbeat and as its last message, and stops at
  once when its client goes away (the body's `cancel`, the request's
  abort, or an abort before it started).
* The browser reconnects with `?since=<checkpoint>` and `away=<ms since
  that checkpoint arrived>`. A checkpoint up to 15 minutes old is
  honoured; one ahead of this server's clock (set by a faster instance)
  is placed with `away`, a duration on the browser's own clock. Anything
  else is refused with `resync`, and the bookings page reloads its list
  (and, in calendar view, the day).
* A large backlog is read 500 rows a poll, in time order, through a strict
  `(updatedAt, id)` cursor, so a page never re-reads the one before.

**Each change is announced once, and only if it is news to the page.**

* The browser sends `loadedAt` — when the page's first listener
  subscribed. Changes from before it are sent as `replayed`: the
  bookings list shows them, the header does not chime or toast. A routine
  reconnect keeps the page's load time, so what happened in the gap still
  chimes; a page that has just loaded does not chime for the past.
* A booking the browser has already announced as new, which a resumed
  stream calls new again, is delivered as an update.

## P23-O1 — revised, not done

The owner chose "hash the links". A hash cannot be turned back into a
link, and these links are read back: every notification and reminder
carries the booking link, the account and payment-return pages build it,
the mobile app fetches it, and the booking page shows a guest's link to
its holder again; none of them expire. Proposed instead: encrypt the
stored link (AES-GCM, key in a new server secret) and look it up by a
keyed hash (HMAC). That needs a new secret in Vercel, a production
backfill and changes to about 20 files; it waits for the owner's
go-ahead.

## Results

| Test | Result | Status |
|---|---|---|
| `npx tsc --noEmit`; `npx eslint .`; `next build` | exit 0; 0 errors (the same 6 old warnings); exit 0 | PASS |
| Full suite, final code | **1300 passed, 34 skipped, 0 failed** (12 new tests) | PASS |
| Access tests (unit + DB) | 71/71. New: the discreet rule (category default, subcategory, owner's choice); the desk hides a medical business by default, shows it when the owner says so, hides any business whose owner asks | PASS |
| Stream client tests | 19/19. New: resumes from the last checkpoint; a malformed checkpoint keeps the last good one; a change is delivered once across streams, a newer version again; a booking already announced as new is delivered as an update; the next page in the tab resumes and nothing is announced twice; resync is passed on; `loadedAt` is set when a page subscribes, kept across reconnects and renewed for the next page; `away` is the time since the checkpoint arrived | PASS |
| Live stream end to end (scratchpad `rt-check.mjs`), final code | checkpoint on open; a change stamped 3 s behind delivered, once; events carry `updatedAt`; the same page reconnecting gets the change made while it was away, announced; a change while connected announced; a 20-minute-old resume point refused with `resync`; a change made 2 s before a new page connected delivered, marked `replayed`; no `resync` on a fresh connection; a resume point 30 s ahead placed by `away` (no resync, the change made while away delivered), and refused without `away`; **a 1,200-row backlog stamped in one instant delivered whole, across pages** — 14/14 twice; the temporary rows removed. With `LONG=1` (review 1 code, close path unchanged since): the stream closed itself after 282.7 s, a checkpoint its last message. Server log after every disconnect: 0 poll errors | PASS |
| Settings switch in a browser (scratchpad `discreet-check.mjs`), final code | Arabic and English: the switch shows the value in force (a salon: off), flipping it saves, the API answers the choice and the default; the "use the default" link appears, puts the value back to null, shows the default, and goes away — 13/13 | PASS |
| QA battery on the first build | `qa-booking-e2e` 22/22, `qa-phase19` 21/21, `qa-phase21` 44/44, `qa-phase22` 68/68, `qa-phase22c` 59/59, `qa-phase23` 48/48, `qa-phase23-loops` 15/15, `qa-loops-browser` 9/9, `qa-security` 32/32, `qa-phase23-browser` 49/49, `qa-venue-console` clean, `qa-redirects` 108/108 | PASS |
| `qa-phase18` (544 page loads, ar + en, 4 widths, axe) | 544 loads, 0 flagged, 0 axe serious/critical | PASS |
| Migration on QA | applied, and again (a no-op); the verify step passes | PASS |

| QA scripts on the final code | `qa-booking-e2e` 22/22, `qa-phase23` 48/48, `qa-phase23-loops` 15/15, `qa-security` 32/32, `qa-phase23-browser` 49/49, `qa-venue-console` clean, `qa-phase22c` 59/59; `qa-phase18` 544 loads, 0 flagged, 0 axe serious/critical; `qa-loops-browser` 8/9, then 9/9 twice after its stream matcher was widened (below) | PASS |

### Review

`a85d348..50e9109`: 8 findings, 7 fixed — a stream whose client left
kept polling (writing its last checkpoint to a cancelled body threw before
the cleanup); a resumed stream could announce a booking as new a second
time; a fresh connection replayed the 5 s before it; the 2-minute resume
limit was shorter than the client's own backoff; the browser kept an old
checkpoint for the next page; the owner could not go back to the default;
a redundant guard. Not taken: the medical-category list as data (recorded
above as a known limit).

`50e9109..38cdd52`: 8 findings, 7 fixed. The first round had traded
missed changes for repeated chimes by narrowing the server's window; the
second showed the cost (a booking made while the page connected was
never shown, and a navigation lost changes). Now nothing is dropped and
the announcement is decided by the client: events from before a fresh
connection are marked `replayed`; the client keeps its checkpoint across
pages; a refused resume point sends `resync`; a poll reads at most 500
rows; the "use the default" link keeps focus until it saves; an abort
before the stream started stops it; one window variable instead of two.
Not taken: the delivered-version map's 1,000-entry cap (a business with
more than 1,000 distinct changes in one tab session could hear a
repeated chime for the oldest).

`38cdd52..63b0f78`: 9 findings, 7 fixed. The 500-row page limit added in
the round before could stall a stream for good (a full page stamped
within the 5 s look-back was re-read every poll) and move the checkpoint
backwards: removed — a resume reads at most 15 minutes of one business's
changes. A resume point slightly ahead (a faster clock elsewhere) is
taken as now instead of forcing a reload. A resync reloads the calendar
day too. A page returning to the dashboard announced changes it had just
loaded: everything from before a connection opens is now `replayed`,
fresh or resumed. "Use the default" moves focus only if it was still on
the link; `since` is read in one place. Not taken: a separate channel for
`resync` (no defect).

`63b0f78..ca370b3`: 7 findings, 5 fixed. Marking everything before a
connection as `replayed` silenced bookings made in the routine 280 s
reconnect gap: the reference is now the page's load time (`loadedAt`),
not the connection's. Taking a resume point from a faster clock as "now"
could skip changes: it is placed by the client's `away` duration, or
refused. A backlog is read in pages again, through a strict
`(updatedAt, id)` cursor that cannot stall (end to end with 1,200 rows
stamped in one instant). Focus for "use the default" is checked before
the save disables the link; the day view reloads on resync only in
calendar view. Not taken: test style (the desk tests' day helper).

Four review rounds were run on the stream. The later ones mostly found
edge cases in the previous round's fixes; the design above is where they
converged.

### Seen, and what it was

| Seen | Cause | Action |
|---|---|---|
| The DB test "EN … security desk" failed once on the new desk | Its fixture business takes the first category, which is "dentists": the desk now hides it, as designed | The test sets the owner's choice to show it; a new test covers the hiding |
| `rt-check` "a stale resume point is ignored" failed on its first run | Test error: the change was made 1.5 s before connecting, inside the fresh stream's 5 s look-back (which is meant to catch exactly that) | Made 7 s before: 0 events with the stale point, as intended |
| Full suite, after review 3: the two security-desk DB tests failed once (the desk row not found) | Both ran across midnight in Cairo: the tests make a pass for now and ask the desk for "today", which had just changed. A latent flake in the existing English desk test, copied into the new one | Both tests now ask for the pass's own day: 71/71, and the full suite 1298 passed, 0 failed |
| `qa-loops-browser` check 2 ("a refused stream stops after 8 attempts") failed: 0 attempts | Test harness: its route `**/api/realtime/bookings` did not match the stream's URL now that it carries a query (`?loadedAt=`), so its simulated refusals never applied | The script's matcher widened to `**/api/realtime/bookings*`: 9/9 twice |
| `rt-check`'s backlog part did not run at first | Test error: copying a booking row copied a generated column; the script also hid the error | Generated columns excluded, and errors now count as a failure: 1200 of 1200 |
| `rt-check` "a stale resume point is ignored" failed after review 1 | Test error: the test's stale point (10 minutes) was inside the new 15-minute limit | 20 minutes, and the change 2 s before connecting, which also checks that a fresh stream does not look back: 6/6 twice |
| A console error in the settings check: `https://localhost:3101/onboarding` failed | The production build's CSP has `upgrade-insecure-requests`, and the QA server is plain http, so a prefetch is upgraded and refused. Not on production (https) | None: an environment artifact |

## Not run

| Test | Why |
|---|---|
| Production | Not deployed; the migration is the owner's to run first |
| Two app instances with skewed clocks | Simulated by stamping `updatedAt` 3 s behind; no second instance locally |
