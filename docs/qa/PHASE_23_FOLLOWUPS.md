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

## P23-A9 — a change stamped by a slower clock

The live stream compared `updatedAt` against the last poll using each
server's own clock. Now:

* each poll re-reads the last 5 s (`OVERLAP_MS`), including the first: a
  change made between the page loading its data and the stream
  connecting is not missed. On a fresh connection what that first look
  finds happened before the page was live, and is marked `replayed`: the
  bookings list shows it, the header does not chime or toast for it;
* a change already sent at the same `updatedAt` is skipped — per stream
  on the server, and across streams in the browser
  (`src/lib/realtime/booking-stream.ts`), since events now carry
  `updatedAt`. A booking the browser was already told is new, and that a
  resumed stream calls new again, is delivered as an update: the header's
  chime and notification fire once. The browser keeps its checkpoint and
  what it delivered across pages in the tab, so a navigation neither loses
  a change nor announces one twice.

## P23-A10 — the 5-minute cut

The platform cut every stream at 5 minutes, mid-poll; the route meant 30,
and nothing told the client where to resume — changes made while it
reconnected were lost.

* `maxDuration = 300`; the stream ends itself at 4 min 40 s.
* It sends a `checkpoint` (the instant up to which everything was sent)
  with each heartbeat and as its last message.
* The client reconnects with `?since=<checkpoint>`; the server accepts a
  resume point under 15 minutes old — longer than the client's own
  backoff across its retries. An older one is refused with a `resync`
  event, and the bookings page reloads its list rather than silently
  missing what changed.
* One poll reads at most 500 rows, oldest first; a longer backlog (a long
  resume at a large business) is read over the next polls.
* A client that goes away stops the stream at once (the body's `cancel`,
  the request's abort, or an abort that came before the stream started),
  without trying to write to it.

A push service stays an option if function time shows on the bill.

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
| Full suite, final code | **1298 passed, 34 skipped, 0 failed** (10 new tests) | PASS |
| Access tests (unit + DB) | 71/71. New: the discreet rule (category default, subcategory, owner's choice); the desk hides a medical business by default, shows it when the owner says so, hides any business whose owner asks | PASS |
| Stream client tests | 17/17. New: resumes from the last checkpoint; a malformed checkpoint keeps the last good one; a change is delivered once across streams, a newer version again; a booking already announced as new is delivered as an update; the next page in the tab resumes and nothing is announced twice; the server's resync is passed on | PASS |
| Live stream end to end (scratchpad `rt-check.mjs`), final code | checkpoint on open; a change stamped 3 s behind delivered, once; events carry `updatedAt`; a change made while disconnected delivered on resuming, and announced (not `replayed`); a 20-minute-old resume point refused with `resync`; a change made 2 s before a fresh connection delivered, marked `replayed`; no `resync` on a fresh connection — 9/9 twice. With `LONG=1` (review 1 code, close path unchanged since): the stream closed itself after 282.7 s, a checkpoint its last message. Server log after every disconnect: 0 poll errors | PASS |
| Settings switch in a browser (scratchpad `discreet-check.mjs`), final code | Arabic and English: the switch shows the value in force (a salon: off), flipping it saves, the API answers the choice and the default; the "use the default" link appears, puts the value back to null, shows the default, and goes away — 13/13 | PASS |
| QA battery on the first build | `qa-booking-e2e` 22/22, `qa-phase19` 21/21, `qa-phase21` 44/44, `qa-phase22` 68/68, `qa-phase22c` 59/59, `qa-phase23` 48/48, `qa-phase23-loops` 15/15, `qa-loops-browser` 9/9, `qa-security` 32/32, `qa-phase23-browser` 49/49, `qa-venue-console` clean, `qa-redirects` 108/108 | PASS |
| `qa-phase18` (544 page loads, ar + en, 4 widths, axe) | 544 loads, 0 flagged, 0 axe serious/critical | PASS |
| Migration on QA | applied, and again (a no-op); the verify step passes | PASS |

| QA scripts on the final code | `qa-booking-e2e` 22/22, `qa-phase23` 48/48, `qa-phase23-loops` 15/15, `qa-loops-browser` 9/9, `qa-security` 32/32, `qa-phase23-browser` 49/49, `qa-venue-console` clean, `qa-phase22c` 59/59; `qa-phase18` 544 loads, 0 flagged, 0 axe serious/critical | PASS |

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

### Seen, and what it was

| Seen | Cause | Action |
|---|---|---|
| The DB test "EN … security desk" failed once on the new desk | Its fixture business takes the first category, which is "dentists": the desk now hides it, as designed | The test sets the owner's choice to show it; a new test covers the hiding |
| `rt-check` "a stale resume point is ignored" failed on its first run | Test error: the change was made 1.5 s before connecting, inside the fresh stream's 5 s look-back (which is meant to catch exactly that) | Made 7 s before: 0 events with the stale point, as intended |
| `rt-check` "a stale resume point is ignored" failed after review 1 | Test error: the test's stale point (10 minutes) was inside the new 15-minute limit | 20 minutes, and the change 2 s before connecting, which also checks that a fresh stream does not look back: 6/6 twice |
| A console error in the settings check: `https://localhost:3101/onboarding` failed | The production build's CSP has `upgrade-insecure-requests`, and the QA server is plain http, so a prefetch is upgraded and refused. Not on production (https) | None: an environment artifact |

## Not run

| Test | Why |
|---|---|
| Production | Not deployed; the migration is the owner's to run first |
| Two app instances with skewed clocks | Simulated by stamping `updatedAt` 3 s behind; no second instance locally |
