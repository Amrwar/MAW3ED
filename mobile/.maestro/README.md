# End-to-end tests (Maestro)

Flows that drive the Android app the way a person would. They run against
the **staging** API (`https://maw-3-ed.vercel.app`), whose data is not ours
to change and may be real, so every flow is:

- **Read-only.** Nothing is booked, cancelled, rescheduled, reviewed,
  reported, saved as a favourite or created, no sign-in code is requested
  and no account is changed. The booking flows stop at "Sign in to book";
  the business flows open a booking but never tap its status, reschedule
  or cancel actions, never tap Today's Confirm or a staff access switch,
  and never open Notifications (opening it marks them read). Send code and
  the business Sign in button are checked for being on or off, never
  tapped (except 05/19 signing in with the review account).
- **Data-agnostic.** No flow names a business, slug, service or person. They
  take "the first card", "the first option", "the first free time".
- **Driven by testID.** Elements are found by `testID` (Android resource
  id), not by their label, which changes with the language and the data.
  Text is matched only where the wording is the point: 07, and the
  language flows (09, 10, 11, 19), which take every string from one file,
  `subflows/strings.js` (each copied from the component named beside it —
  change it there when the copy changes).

Flows run in Arabic, the app's default, except 07 and the English half of
the language flows.

| Flow | What it covers |
| --- | --- |
| `01-launch-home` | The app opens on Home and lists at least one business. |
| `02-search` | Search shows results or its empty state; a nonsense term (`zzzzqqq`) shows "no places match". |
| `03-business-profile` | The first business on Home opens; its book bar (or "nothing to book yet") shows; scroll through; back to Home. |
| `04-booking-guest` | As a guest: Book, then answer each step (service, staff, branch, table, day and time) until "Sign in to book". Never submits. |
| `05-business-login` | Business sign-in with email and password; Today, the first booking if any, Calendar, Customers; sign out from More. |
| `06-offline` | Airplane mode: the offline banner appears, an already-loaded business still opens, the banner goes when back online. |
| `07-english` | Switch to English on the sign-in screen; Home in English. |
| `08-nearby-denied` | "Near me" with the location permission denied: the explanation (and area picker) shows, no crash. |
| `09-i18n-arabic` | Arabic on Home, Search and its filter/sort sheets, the city sheet, the signed-out Bookings/Favorites/Account prompts, sign-in (customer and business tabs, the language switch there and back), a business page, the first booking step, Near me: each shows its Arabic words, the chrome (tabs, buttons, titles) holds no Latin letter, and it is laid out right to left (positions compared with `rightOf`). |
| `10-i18n-english` | The same tour in English: English words, no Arabic letter in the chrome, left to right. |
| `11-sign-up-surfaces` | In both languages: the sign-in prompts reach sign-in; the customer tab says it is also sign-up; the country picker opens, finds nothing for "zzzz", finds Egypt (named in the language), selects it (+20) and closes (also with Back); Send code stays off for "12345", turns on for "01012345678", and is never tapped; Terms and Privacy open the website; the business form keeps Sign in off for an invalid email (never sent); Forgot password and Create a business account open the website, and the app is still where it was after. |
| `12-tabs-and-back` | Every customer tab; the signed-out prompts open sign-in and come back; Android Back from sign-in, a business page, all reviews, the booking steps, Near me and a search result lands in the app every time. |
| `13-search-filters` | Home's city picker (a city, then all cities); a category tile opens Search filtered by it, and its chip removes it; filters applied, cleared, and dropped when the sheet is closed or Backed out of; every sort order, marked as chosen; the empty state's "clear filters". |
| `14-business-page` | The photo viewer (next, swipe, close, Back), Share (system sheet, then Back), a service's sheet and a team member's sheet (close and Back), a gallery tile, all reviews sorted and filtered by stars, Directions (another app, then back to the same page). Missing sections are skipped. |
| `15-booking-navigation` | As a guest: Back keeps the chosen service and time; the day strip scrolls both ways; choosing another service clears the time. Stops at "Sign in to book". |
| `16-deep-links` | `maw3ed://` links, warm and from a cold start: search, nearby, favourites and bookings (the sign-in prompt), a malformed booking link, a place that does not exist (says so; Back goes Home), an unknown path (Home). |
| `17-background-relaunch` | Home key and back: the same business page, typed search and booking step. Killed and opened again: Home shows places within seconds. |
| `18-offline-launch` | Started offline after one visit: banner plus the saved places; started offline on a fresh install: banner, no places, and they arrive once back online. |
| `19-business-tour` | The review account, in Arabic then English: Today and a booking (opened only), Calendar day/week and its arrows (dates compared), status chips, Customers search (none for "zzzzqqq") and a customer, More's profile/staff/services/reports screens, the language buttons, sign out. |

`subflows/` holds pieces the flows call — `start.yaml` (fresh launch,
signed out, location refused, in `APP_LANG`, strings loaded), the language
checks (`chrome-words`, `tab-label`, `reading-order`), the tours the
language flows share, and the booking steps. They are not run on their own.

### Tags

| Tag | Flows | |
| --- | --- | --- |
| `smoke` | 01-04, 07 | Quick: does the app work at all. |
| `i18n` | 09, 10, 11 | Wording and direction in both languages. (19 checks both languages too, but needs credentials.) |
| `deep` | 12-19 | Navigation in depth; slower. |
| `android` | 06, 08, 12, 17, 18 | Android-only commands (airplane mode, permissions, Back and Home keys). |
| `auth` | 11 | The sign-in and sign-up screens. |
| `needs-credentials` | 05, 19 | Signs in as the review account. |

Run a subset with `--include-tags` / `--exclude-tags` (see below).

### What Maestro cannot check here

- **https://www.maw3ed.net links.** Only production builds declare the
  Android app-link filter (`app.config.ts`), so on the staging build they
  open the browser; 16 uses `maw3ed://` links instead. A link to a real
  place needs its slug, which nothing on screen exposes, so 16 links to a
  missing place and 03/14 open real ones from Home.
- **Layout direction** is checked by position (`rightOf` / `leftOf`
  between two elements), which covers rows and headers; whole-screen
  mirroring is left to the paired screenshots, `<screen>-ar.png` and
  `<screen>-en.png`.
- **Typing Arabic.** `inputText` cannot type Arabic on Android, so the
  Arabic country search types "Egypt" (the list matches either name).
- **The Terms/Privacy links** are spans inside one line of text. Recent
  React Native exposes them to Android accessibility as their own nodes;
  if a build does not, 11 skips those two taps (`optional`) and only the
  wording is checked.
- **What opens outside the app** (the share sheet, maps, the browser) is
  only photographed; the flows check that the app comes back where it was.
- **The day strip's scroll** is shown in screenshots (15), not measured.

## Staging data the flows need

- At least one business on Home (all but 05), and one category with
  places (13).
- The first business on Home has a service with a free time within its
  first four open days (04, 15). If not, they fail at "Pick the first free
  time". 15's "another service clears the time" needs it to have two
  services, and is skipped otherwise; 14 skips sections it does not have.
- A business account for 05 and 19 (see below). Its own data is only
  looked at.

## Credentials

Flows 05 and 19 sign in as a review business account. Never write the
credentials into a flow. They read either name:

| Where | Variables |
| --- | --- |
| Local | `REVIEW_EMAIL`, `REVIEW_PASSWORD` (passed with `-e`) |
| EAS | `MAESTRO_REVIEW_EMAIL`, `MAESTRO_REVIEW_PASSWORD`, set as EAS environment variables in the `preview` environment, with secret visibility. Maestro reads `MAESTRO_`-prefixed variables by itself. |

Both are tagged `needs-credentials`. Leave them out with
`--exclude-tags needs-credentials`.

## Running locally

Needs the [Maestro CLI](https://maestro.mobile.dev), an Android emulator,
and a staging build installed on it (`net.maw3ed.app.staging`), e.g. the
APK from `eas build -p android --profile e2e` (or `preview`).

```sh
cd mobile
maestro test .maestro \
  -e REVIEW_EMAIL=review@example.com -e REVIEW_PASSWORD='…'
# one flow
maestro test .maestro/04-booking-guest.yaml
# everything except the flows that sign in
maestro test .maestro --exclude-tags needs-credentials
# a subset by tag: the language flows, the quick ones, the deep ones
maestro test .maestro --include-tags i18n
maestro test .maestro --include-tags smoke
maestro test .maestro --include-tags deep --exclude-tags needs-credentials
```

`config.yaml` sets the order and keeps going after a failure. Screenshots
land in the working directory.

## Running in GitHub Actions (cloud, free)

`.github/workflows/e2e-android.yml` (at the repo root) starts an Android
emulator, installs an APK, runs every flow and keeps the screenshots,
recordings and a JUnit report as the run's `maestro-results` artifact.

1. Build the APK: `cd mobile && npx eas-cli build -p android --profile e2e`.
2. Put its URL in the repository variable `E2E_APK_URL`
   (`gh variable set E2E_APK_URL --body <url>`), or pass it as the
   `apk_url` input when starting the workflow by hand.
3. Add the review account as repository secrets `REVIEW_EMAIL` and
   `REVIEW_PASSWORD`; without them the business flows (05, 19) are skipped.

It runs on any push that changes these flows, and by hand from the
Actions tab (once the workflow is on `main`).

## Running in EAS (paid plans only)

Expo runs Maestro jobs only on a paid plan. With one,
`.eas/workflows/e2e-android.yml` builds the `e2e` profile (an APK against
staging, debug-signed, so it needs no keystore) and runs these flows on an
Android emulator, with a screen recording and one retry for failed flows.

```sh
cd mobile
npx eas-cli workflow:run .eas/workflows/e2e-android.yml
```

Results, screenshots and recordings are on the workflow run's page in the
Expo dashboard.

## Adding a flow

Give each new element a `testID` in the component, not a text match.
Start the flow with `runFlow: subflows/start.yaml` (or
`launchApp: { clearState: true }`), wait for network content with
`extendedWaitUntil` (about 20-30 s), and add the file to `config.yaml`
and to `flow_path` in `.eas/workflows/e2e-android.yml`. Words checked by
a language flow go in `subflows/strings.js`, both languages, never in the
flow itself.
