# Phase 25 — regression results

Date: 2026-11-03. Environment: Windows 11, the QA server as a production
build (`next build`, then `next start -p 3101`) with `ACCESS_SANDBOX=1`
against the QA Postgres in Docker (`maw3ed-qa`). The app's web build
(`npx expo export --platform web`) is served by
`scripts/app-web-serve.mjs` on :8090, forwarding `/api` to the QA
server. Secrets were read from local files and never printed. Nothing ran
against production.

**Build under test:** branch `phase-25` at `55e3bfb`. It includes:

* the Phase 25 code (`dec776f`, `8b56dea`);
* review rounds 1 and 2 (`7a1167e`, `55e3bfb`);
* the offline-QR work from PR #51, merged in (`bc29d46`). The owner
  asked for offline QR first, and PR #51 is not yet on `main`, so this
  battery tests both together.

The web server was rebuilt on `bc29d46`. Round 2 (`55e3bfb`) changed
only `mobile/` and one QA script, so the server build is the same. The
app was re-exported on `55e3bfb`.

## Static checks and suites

| Test | Command | Result | Status |
|---|---|---|---|
| TypeScript, web | `npx tsc --noEmit` | 0 errors | PASS |
| ESLint, web | `npx eslint .` | 0 errors, 6 warnings (the same 6 as `main`) | PASS |
| Unit, integration and DB, web | `BOOKING_DB_TEST_URL=… DATABASE_URL=… npx vitest run --no-file-parallelism` | **1319 passed**, 34 skipped, 0 failed (121 files) | PASS |
| TypeScript, mobile | `cd mobile && npx tsc --noEmit` | 0 errors | PASS |
| ESLint, mobile | `cd mobile && npx eslint .` | 0 problems | PASS |
| Unit, mobile | `cd mobile && npx vitest run` | **240 passed**, 10 skipped (one integration file needs a device keychain) | PASS |
| Expo doctor | `cd mobile && npx expo-doctor` | 21/21 | PASS |
| Production build, web | `npx next build` | Compiled (`bc29d46`) | PASS |
| Production export, app | `npx expo export --platform web` | Exported (`55e3bfb`) | PASS |
| Dependency audit, web | `npm audit --omit=dev` | 5 moderate, unchanged since Phase 22 (O3) | Known |
| Dependency audit, mobile | `cd mobile && npm audit --omit=dev` | 31 (2 low, 23 moderate, 6 high). It was 30: the one new item is `expo-sharing` → `@expo/config-plugins`, the same build-time advisory `expo-splash-screen` already carries. No new high | Known (P25-D) |

## End-to-end and regression scripts

Run on the build above. Each script cleans up the QA data it created.

| Script | What it covers | Result |
|---|---|---|
| `qa-phase25-app.mjs` | **The app**: discovery, organization, section, business, booking credited to the mall, check-in QR, a pass pending → active, guests, the guest's own pass, QR visits, venue, not found, offline, cold start without an answer, back online re-check (once, then quiet), ended session, polling bound, support, data export, English, no sideways scrolling | **35/35** |
| `qa-offline-qr.mjs` | Offline booking page and Save QR, in Chromium, WebKit and Firefox; link previews; the saved image scans | **31/31** |
| `qa-phase24.mjs` | Organization platform A–D, journey, exceptions, security | **147/147** after an audit fix to the script. The first run was 146/146: check 3.10 "arriving more than 30 minutes early" only ran when the slot the clock gave happened to be more than 30 minutes away, so it was silently skipped. It now moves the booking an hour ahead first and runs every time (P25-A3). The one-off 4.17 failure in an earlier offline-QR run was already fixed in that work (its own tenant, a booking moved to 20 minutes ahead), and has passed on every run since |
| `qa-phase24-browser.mjs` | Organization journey in a browser, offline, ar/en × 375/1440, failures | **23/23** |
| `qa-phase23.mjs` | Venue access, passes, providers | **48/48** |
| `qa-phase23-loops.mjs` | Retry and poll bounds | **15/15** |
| `qa-phase23-browser.mjs` | Access panel in a browser | **49/49** |
| `qa-security.mjs` | Authorization, isolation, tokens | **32/32** |
| `qa-booking-e2e.mjs` | Booking end to end; 22 URL compatibility addresses | **22/22** |
| `qa-phase22c.mjs`, `22b`, `22` | Organizations, delegation, console | **58/58**, **83/83**, **66/66** |
| `qa-phase21.mjs`, `19`, `17` | Earlier phases | **44/44**, **21/21**, **13/13** |
| `qa-venue-console.mjs`, `qa-venue-page.mjs` | Venue console and public page, ar/en × 375/1440 | all clean |
| `qa-phase18.mjs --only owner` | Site sweep, signed-in owner | 144 loads, 0 flagged |
| `qa-phase18.mjs --only admin` | Site sweep, admin | 72 loads, 0 flagged |
| `qa-phase18.mjs --only anon` | Site sweep, signed out | **224 loads, 0 flagged** (second run) |

### The first anonymous sweep

The first anonymous run flagged 3 of 218 loads and was cut off by its
280 s limit:

* `/en/forgot-password`: "Page crashed";
* `/en/help`: "browser has been closed";
* `/en/demo`: 10 console errors in the same dying browser.

Each of these pages was then opened alone at 375 and 1440, and Arabic
`/demo` too. Every one returned 200, with no overflow and 0 console
errors.

The full sweep was re-run with a longer limit: 224 loads, 0 flagged. The
crash was the browser process on a machine under memory pressure (the
same cause as in Phases 23–24), not a page defect.

## Not run

| Test | Why | Next action |
|---|---|---|
| Android and iOS release builds, device/emulator tests, Maestro on EAS | Owner's Expo sign-in, Apple and Google accounts, and a non-production test backend are needed | `docs/mobile-release.md`, "What the owner has to do" |
| Push, OS share sheet, app links, keychain on a real OS | Same | Same |
| Production verification | Nothing for this phase is deployed; the app talks to the same production API only after release | After store builds |
