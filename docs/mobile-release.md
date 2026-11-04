# Mobile app — release preparation (Phase 25)

Date: 2026-11-03. The customer app is `mobile/` (Expo SDK 57, React
Native 0.86, expo-router). This page is the checklist for a store release
and the honest state of each item. Architecture: `docs/mobile.md`. Links:
`docs/deep-links.md`. Push: `docs/push-setup.md`. Store text and privacy
answers: `docs/store/listing.md`.

**Nothing has been submitted to either store, and no store has
approved anything.**

## Readiness by platform

| | Android | iOS |
|---|---|---|
| App code | Ready. Shared code, tested (below) | Ready. Shared code, tested (below) |
| Configuration resolves for production | **Yes** (`npx expo config --type prebuild`, `APP_ENV=production`) | **Yes** |
| Expo health check | `npx expo-doctor`: **21/21** | Same project: 21/21 |
| Identifiers | `net.maw3ed.app` (staging `.staging`, development `.dev`) | `net.maw3ed.app` (staging `.staging`, development `.dev`) |
| Release build | **NOT BUILT.** EAS cloud build (`eas build -p android --profile production`, AAB) needs the owner's Expo sign-in | **NOT BUILT.** Needs the owner's Expo sign-in **and** an Apple Developer account (signing); there is no Mac here |
| Run on a device or emulator | **NOT RUN.** No Android SDK or emulator on this PC (and ~3 GB free memory); the Maestro flows run on EAS's emulator once a test backend exists (below) | **NOT RUN.** No Mac; TestFlight needs the Apple account |
| App links | Intent filters for the 8 paths, `autoVerify`. Verification needs the release key's SHA-256 in `ANDROID_CERT_SHA` (web, `/.well-known/assetlinks.json`) | Associated domain `applinks:www.maw3ed.net`. Needs `APPLE_TEAM_ID` (web, `/.well-known/apple-app-site-association`) |
| Push | FCM: `google-services.json` from Firebase (`GOOGLE_SERVICES_JSON` EAS file) | APNs key in EAS credentials. See `docs/push-setup.md` |
| Maps | `GOOGLE_MAPS_ANDROID_API_KEY` (EAS secret) for the "near me" map | Apple Maps; no key |
| Permissions | Internet, notifications, location (coarse/fine, while in use). Storage, overlay and background location are blocked | Location while in use, notifications. Strings in Arabic and English (`mobile/locales/*.json`) |
| Icons and splash | `adaptive-icon.png` 1024 px. **[VERIFY]** upscaled from a small raster; a designer master is recommended | `icon.png` 1024 px, opaque. Same caveat |
| Store listing | `docs/store/listing.md`, with open **[VERIFY]** items for the owner (the brand name, the address, the age rating) | Same |
| Store submission | `submit.production` in `eas.json` is empty. Needs a Play service-account key and the app created in Play Console | Needs an App Store Connect app, an ASC API key or Apple ID, and a reviewer account (`docs/store/listing.md` §9) |

**Android: code and configuration ready, not built.**
**iOS: code and configuration ready, not built.**
Both are blocked on the owner's accounts (below), not on code.

## What the owner has to do (in order)

1. **Sign in to Expo** on this machine:
   ```
   ! npx eas-cli login
   ```
   The project is already linked (`expo.dev/@amrwar/maw3ed`).
2. **The test backend for device E2E: done.**
   - The `e2e` build profile points at the staging server,
     `https://maw3ed-staging.vercel.app` (`docs/staging.md`): its own
     Vercel project and database, fictional data, no messaging or payment
     keys. Before Phase 25 it used the production site, so every automated
     flow counted as real visits.
   - Still to do: add the staging review account to the EAS **preview**
     environment as `MAESTRO_REVIEW_EMAIL` and `MAESTRO_REVIEW_PASSWORD`
     (secret visibility). The values are not in the repository.
   - The `preview` profile (internal testers) still uses the live site, as
     a customer would.
3. **Android:**
   - `eas build -p android --profile production`.
   - Copy the signing key's SHA-256 into Vercel `ANDROID_CERT_SHA`.
   - Upload `google-services.json` (`GOOGLE_SERVICES_JSON`).
   - Set the Maps key.
   - Create the app in Play Console, then fill `submit.production.android`.
4. **iOS:**
   - Enrol in the Apple Developer Program.
   - `eas build -p ios --profile production`, which lets EAS manage
     signing.
   - Set `APPLE_TEAM_ID` in Vercel.
   - Add the APNs key.
   - Create the App Store Connect app, then fill `submit.production.ios`.
5. **Device checks.** Run Maestro on EAS:
   ```
   npx eas-cli workflow:run .eas/workflows/e2e-android.yml
   ```
   Then the device checklists in `docs/push-setup.md` and
   `docs/deep-links.md`. The new screens' flows are listed in "Device
   tests to add".
6. **Submit**, after resolving the `[VERIFY]` items. Reviews are Apple's
   and Google's. Nothing here claims approval.

## What was verified without a device (Phase 25)

| Check | Result |
|---|---|
| `npx tsc --noEmit` (mobile) | 0 errors |
| `npx eslint .` (mobile) | 0 problems |
| `npx vitest run` (mobile) | **231 passed**, 10 skipped |
| `npx expo-doctor` | 21/21 |
| Production configuration resolved | bundle and package ids, 8 link paths, associated domain, localized permission strings, plugins |
| The app itself, in a browser: its own web build (`npx expo export --platform web`) served by `scripts/app-web-serve.mjs` against the QA server, never production | `scripts/qa-phase25-app.mjs`: **34/34** (see the Phase 25 report) |

What a browser cannot prove, and devices must:
- the share sheet;
- push delivery and taps;
- the keychain and keystore;
- universal links and app links opening the app;
- safe areas and notches;
- the system back button;
- background and foreground on a real OS;
- memory on a low-end phone.

## Device tests to add (Maestro) for the Phase 25 screens

- `20-places`: Home → malls and groups → an organization → a section chip → a business. Read only.
- `21-org-deep-link`: open `https://www.maw3ed.net/groups/<slug>?src=qr`; the organization screen.
- `22-booking-access`: open a test booking's link; the check-in QR is visible. Read only: asking for a pass writes, so that belongs on a test backend.
- `23-guest-pass-link`: open `/pass/<invalid>`; "this link doesn't work".

These need the test backend from step 2, and real fixture slugs there.
