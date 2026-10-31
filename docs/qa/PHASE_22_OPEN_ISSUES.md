# Phase 22 — open issues after the post-phase audit

Date: 2026-10-31. Nothing here is P0 or P1. Each issue has an owner
(who must act) and the exact next action.

| # | Severity | Issue | Why it is not fixed in this phase | Owner | Next action |
|---|---|---|---|---|---|
| O1 | Release gate | Phase 22 final (PR #46) and its two migrations are **not deployed**; no signed-in production check has run | Production access is the owner's | Owner | Merge #44, #45; run `migrate-phase22c.sh`; merge #46; run the signed-in check (register → approve → invite as OWNED → accept with a grant → operate → withdraw) |
| O2 | P2 (security, mobile) | `npm audit` (mobile): 30 advisories, 6 high. The reachable high: `decode-uri-component` (through expo-router's query-string) can hang the app on a malformed deep link — self-inflicted, on that device only. The others are in Expo's build tooling (`@expo/cli`, a transitive `zod`), not shipped; the app's own zod is the fixed 4.6.7 | Every fix is a **major Expo SDK upgrade** — native modules, new store builds — out of this phase's scope | Mobile | Plan the Expo SDK upgrade as its own task. Exposure is narrowed, not removed: https links are accepted only from `maw3ed.net`/`www.maw3ed.net` (`mobile/lib/links.ts`), but the custom `maw3ed://` scheme can be invoked by any app or web page |
| O3 | P3 (dependency) | `npm audit` (web): 5 moderate (glob/minimatch through Sentry's build-time plugin), unreachable from requests | The only offered fix is a major-version Sentry downgrade | Platform | Re-check when Sentry ships a fixed release |
| O4 | P3 (test reliability) | Intermittent 60 s timeouts in `reliability.db.test.ts` booking-contention tests, seen twice under full-suite load on this machine; 6/6 clean in an A/B, and clean in every later run | Not reproducible on demand; no change to the booking engine in this phase | Platform | If it recurs in CI, raise those tests' timeout or run the file in its own worker |
| O5 | P3 (product) | Directory loading skeleton deliberately absent (a route `loading.tsx` turned 404s into soft-404s) | Correct HTTP status outweighs a skeleton for a one-query page | Product | Revisit only with a design that keeps 404 status (in-page Suspense after the existence check) |
| O6 | Decision | Privacy: processor terms when a business grants an organization access to customers | Legal decision | Owner + counsel | Resolve the `[DECISION]` in `docs/legal/PRIVACY_POLICY_DRAFT.md` |
| O7 | Limitation | Delegated management is web-only; the mobile app has no acting context | Out of scope | Product | Decide whether delegates need it in the app |
| O8 | External | Gate hardware / Emaar integration | External: needs a written agreement and interface documentation | Owner | Separate milestone; blocks nothing in Phase 22 |
| O9 | Not applicable yet | Booking check-in QR and visitor-pass journeys (provisioning, revocation, provider failure) | Phase 23 | — | Covered by Phase 23 |
