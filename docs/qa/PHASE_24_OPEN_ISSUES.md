# Phase 24 — open issues after the post-phase audit

Date: 2026-11-03. **No P0 or P1 is open.** Each issue has an owner and
an exact next action.

| # | Severity | Issue | Why not fixed now | Owner | Next action |
|---|---|---|---|---|---|
| ~~P24-G1~~ | Closed 2026-11-03 | The final build was served and every run completed: `qa-phase24` 147/147, browser 23/23, 14 earlier QA scripts, and the sweep (544 loads, 0 flagged) | — | — | — |
| ~~P24-G2~~ | Closed 2026-11-03 | Production migration applied and VERIFIED by the owner | — | Owner | Merge the PR |
| P24-E | External (BLOCKED) | No real gate partner (agreement, documentation, credentials, test gate) | External | Owner / partner | `docs/eterna/PARTNER_INTEGRATION_STATUS.md` |
| P24-L | Release gate (pilot) | No real operator; the pilot is not LIVE | Owner decision (Eterna is a concept) | Owner | `docs/eterna/PILOT_PLAN.md`, stage 0 |
| ~~P24-F1~~ | Closed 2026-11-03 (branch `offline-qr`) | Fixed with both options. The phone keeps the customer's own booking page, with its scripts, styles and fonts, until the check-in window closes. Offline, on a hanging network or on a server error it shows that copy, marked as a saved copy; a new code, a pass or a cancellation updates or deletes it. "Save QR as image" saves a PNG to photos or files. `scripts/qa-offline-qr.mjs` 31/31 in Chromium, WebKit and Firefox; two independent review rounds (20 findings) fixed | — | — |
| P24-P1 | P3 (performance, local) | Latency on this PC varies by run: load 13/13 (B1), 10/13 and 13/13 (B2), 12/13 (B3). The misses (the directory page up to 1,033 ms against 1,000; QR scans 327–347 ms against 300; callbacks 371 ms against 300) come in runs where **every** route, including untouched ones, is about 2.5× slower, while the PC has about 3–4 GB free. Correctness passed in every run | Not a code regression: unchanged routes slow down equally. Production is a different platform | Engineering | Measure on a Vercel preview with the same script (`--tenants 40`); if p95 stays above 500 ms there, cache the directory query (it is public and changes rarely) |
| P24-R3 | P3 (design, accepted) | While a person acts for another business, the delegable routes, now including tables, serve the acting business. A stale tab of their own business would add a table to the acting one. The banner shows which business is being operated | Same contract as services, staff and bookings since Phase 22. Changing one route alone would make them inconsistent | Product | If wanted: send the intended business id with each delegable write and refuse a mismatch, for all delegable routes together |
| P24-R4 | P3 (wording) | A business with a business-wide relationship without reports **and** a branch relationship is labelled "not granted", not "branch only" | Correct: the business-wide relationship could carry reports | — | None |
| P24-T | P3 (robustness) | The console's fetches have no client timeout; a hung request ends at the platform limit (300 s) | The page stays usable; the portfolio is an optional section | Engineering | An `AbortSignal.timeout(30_000)` in the console's `api()` helper |
| Ph22 O2/O3 | P2/P3 (dependencies) | `npm audit`: web 5 moderate, mobile 30 (6 high). Unchanged | Major Expo and Sentry upgrades | Mobile / platform | As in `PHASE_22_OPEN_ISSUES.md` |
| Ph22 O6 | Decision | Privacy: processor terms when a business grants an organization customer access | Legal | Owner + counsel | `docs/legal/PRIVACY_POLICY_DRAFT.md` `[DECISION]` |
