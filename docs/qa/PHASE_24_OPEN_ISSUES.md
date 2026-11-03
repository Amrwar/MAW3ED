# Phase 24 — open issues after the post-phase audit

Date: 2026-11-03. **No P0 or P1 is open.** Each issue has an owner and
an exact next action.

| # | Severity | Issue | Why not fixed now | Owner | Next action |
|---|---|---|---|---|---|
| P24-G1 | Release gate | The audit's final build (B3, `6ea7a05`) has not been served: the browser checks of review round 2, the site-wide sweep (`qa-phase18`) and part of the regression battery did not run, because the QA server was stopped for low memory | The machine, not the code: ~2.7 GB free with ~19 GB held by Chrome. Background jobs are not restarted without the owner's say-so | Owner (approve), then engineering | Close spare Chrome windows; approve; run `qa24-server.sh` then `qa24-regress.sh` (scratchpad), then `qa-phase24.mjs` and `qa-phase24-browser.mjs` |
| P24-G2 | Release gate | Production migration `phase24_resources_scope.sql` not applied | Production access is the owner's | Owner | `! bash …/scratchpad/migrate-phase24.sh` → `applied`, `VERIFIED`; then merge |
| P24-E | External (BLOCKED) | No real gate partner (agreement, documentation, credentials, test gate) | External | Owner / partner | `docs/eterna/PARTNER_INTEGRATION_STATUS.md` |
| P24-L | Release gate (pilot) | No real operator; the pilot is not LIVE | Owner decision (Eterna is a concept) | Owner | `docs/eterna/PILOT_PLAN.md`, stage 0 |
| P24-F1 | P2 (pilot) | Reloading the booking page offline shows the offline notice, not the QR | Product and privacy decision (keeping a copy of a secret page on the device) | Product | Options in `LAUNCH_READINESS.md` F1; staff fallback documented |
| P24-P1 | P3 (performance, local) | Directory page p95 under 20 concurrent visitors varied between runs: 369 ms (B1), 1,033 ms (audit run 1, over the 1,000 ms target), 949 ms (audit run 2). Every other scenario was 2.5–3× slower in run 1 and back to baseline in run 2, which points at the machine | Not reproducible on demand; the page is unchanged by Phase 24 | Engineering | Measure on a Vercel preview with the same script (`--tenants 40`); if p95 stays above 500 ms there, cache the directory query (it is public and changes rarely) |
| P24-R3 | P3 (design, accepted) | While a person acts for another business, the delegable routes, now including tables, serve the acting business. A stale tab of their own business would add a table to the acting one. The banner shows which business is being operated | Same contract as services, staff and bookings since Phase 22. Changing one route alone would make them inconsistent | Product | If wanted: send the intended business id with each delegable write and refuse a mismatch, for all delegable routes together |
| P24-R4 | P3 (wording) | A business with a business-wide relationship without reports **and** a branch relationship is labelled "not granted", not "branch only" | Correct: the business-wide relationship could carry reports | — | None |
| P24-T | P3 (robustness) | The console's fetches have no client timeout; a hung request ends at the platform limit (300 s) | The page stays usable; the portfolio is an optional section | Engineering | An `AbortSignal.timeout(30_000)` in the console's `api()` helper |
| Ph22 O2/O3 | P2/P3 (dependencies) | `npm audit`: web 5 moderate, mobile 30 (6 high). Unchanged | Major Expo and Sentry upgrades | Mobile / platform | As in `PHASE_22_OPEN_ISSUES.md` |
| Ph22 O6 | Decision | Privacy: processor terms when a business grants an organization customer access | Legal | Owner + counsel | `docs/legal/PRIVACY_POLICY_DRAFT.md` `[DECISION]` |
