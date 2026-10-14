# End-to-end tests (Maestro)

Flows that drive the Android app the way a person would. They run against
the **staging** API (`https://maw-3-ed.vercel.app`), whose data is not ours
to change and may be real, so every flow is:

- **Read-only.** Nothing is booked, cancelled, reviewed, saved as a favourite
  or created. The booking flow stops at "Sign in to book"; the business flow
  opens a booking but never taps its status, reschedule or cancel actions.
- **Data-agnostic.** No flow names a business, slug, service or person. They
  take "the first card", "the first option", "the first free time".
- **Text-agnostic.** Elements are found by `testID` (Android resource id), not
  by their label, which changes with the language and the data. The one
  exception is 07, which checks the app's own "Home" tab label to prove the
  language changed.

Flows run in Arabic, the app's default, except 07.

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

`subflows/` holds pieces the flows call (one booking step; picking a day
with free times). They are not run on their own.

## Staging data the flows need

- At least one business on Home (01, 03, 04, 06, 07, 08).
- The first business on Home has a service with a free time within its
  first four open days (04). If not, 04 fails at "Pick the first free time".
- A business account for 05 (see below). Its own data is only looked at.

## Credentials

Flow 05 signs in as a review business account. Never write the
credentials into a flow. It reads either name:

| Where | Variables |
| --- | --- |
| Local | `REVIEW_EMAIL`, `REVIEW_PASSWORD` (passed with `-e`) |
| EAS | `MAESTRO_REVIEW_EMAIL`, `MAESTRO_REVIEW_PASSWORD`, set as EAS environment variables in the `preview` environment, with secret visibility. Maestro reads `MAESTRO_`-prefixed variables by itself. |

05 is tagged `needs-credentials`. Leave it out with
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
# everything except the sign-in flow
maestro test .maestro --exclude-tags needs-credentials
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
   `REVIEW_PASSWORD`; without them the business sign-in flow is skipped.

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
Start the flow with `launchApp: { clearState: true }`, wait for network
content with `extendedWaitUntil` (about 20 s), and add the file to
`config.yaml` and to `flow_path` in the workflow.
