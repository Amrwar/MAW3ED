# Phase 25 — open issues after the post-phase audit

Date: 2026-11-03. **No P0 or P1 is open.** Each issue has an owner and
an exact next action.

| # | Severity | Issue | Why not fixed now | Owner | Next action |
|---|---|---|---|---|---|
| P25-B1 | Release gate (BLOCKED) | No Android or iOS release build; no device or emulator test, Maestro on EAS, push, app links, share sheet or keychain on a real OS | Needs the owner's Expo sign-in, a Google Play and an Apple Developer account, and a non-production test backend for the `e2e` profile | Owner | `docs/mobile-release.md`, "What the owner has to do": `! npx eas-cli login`, then the EAS cloud builds (the owner chose these) |
| P25-B2 | Release gate | `ANDROID_CERT_SHA` and `APPLE_TEAM_ID` are not set, so `assetlinks.json` and the Apple association file serve no app yet | Known after the first signed build | Owner | Set both in Vercel after the first EAS build (`docs/deep-links.md`) |
| P25-M1 | Merge order | This branch includes PR #51 (offline QR), merged in at `bc29d46` | The owner asked for offline QR first; #51 is open | Owner | Merge #51 first, then the Phase 25 PR (its diff then shows only Phase 25) |
| P25-R6 | P3 (design, accepted) | Failed polls count toward the pass-polling budget, so a run of 5xx can show "check again" early (review 2, finding 6) | Intended: it is what keeps a failing server from being asked forever (L1). Offline does not count (TanStack pauses fetches). "Check again" resets the count | — | None |
| P25-R8 | P3 (not a defect) | Review 2, finding 8: persisted organization and venue detail in "the previous language" | The payload carries both names and the screen picks one per language, so nothing is in the wrong language. It is public data, like the businesses already persisted | — | None |
| P25-D | P2/P3 (dependencies) | `npm audit`: mobile 31 (6 high), web 5 moderate. One more than Phase 22: `expo-sharing` → `@expo/config-plugins` (build-time tooling, the same advisory as `expo-splash-screen`) | Fixes need major Expo/Sentry upgrades | Mobile / platform | As in `PHASE_22_OPEN_ISSUES.md` (O2/O3) |
| P24-E, P24-L | External | Real gate partner and pilot operator, unchanged | External / owner | Owner | `docs/eterna/*` |
| P24-P1 | P3 | Local latency variance (Phase 24) | Unchanged | Engineering | Measure on a Vercel preview |
