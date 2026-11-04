# Enterprise release readiness

Four separate verdicts, as the Phase 28 brief asks. Evidence is in
`docs/phases/PHASE_28_REPORT.md`; nothing below claims more than it shows.

## 1. Enterprise code readiness — READY (local)

- Multiple independent organizations, OWNED/HOSTED/MANAGED coexisting, one business with
  several relationships, venue- and branch-scoped roles: built in Phases 22–24, unchanged,
  re-verified.
- Phase 28 adds: the read-only `/api/v1` with hashed scoped keys, contracts, per-key rate
  limits and usage; signed webhooks with bounded retries and auto-disable; per-venue provider
  credentials; contracts (limits, no prices); payment reconciliation; job-run recording,
  `/api/health`, feature flags; the organization Integrations console and admin Operations page.
- Proved by unit tests, database tests (API auth/limits/isolation, feed/delivery/retry
  termination, provider isolation) and an HTTP run that provisions two organizations.

## 2. Second test organization readiness — READY (fictional, QA)

`scripts/qa-phase28.mjs` provisions, through the product's own APIs and with no code per
organization, a fictional mall (hosted tenants, venue, sandbox provider) and a fictional
restaurant group (owned brands with reservations/reports/finance, its own venue), each with
its own contract, key, webhook and venue credential, and checks directories, data, consoles,
credentials, billing (contracts) and reports stay separate. Fictional data only; nothing on
production.

## 3. Production deployment readiness — READY AFTER THE MIGRATION

- Requires `prisma/migrations/phase28_enterprise.sql` on production before the deploy
  (additive, idempotent; the owner runs the prepared script).
- Requires nothing else: no new environment variable is mandatory. Optional:
  `FEATURE_FLAGS_OFF`, `ACCESS_CREDENTIAL_KEY` (a dedicated sealing key — recommended before
  storing real partner credentials). Never set `WEBHOOK_ALLOW_PRIVATE` on Vercel (it is
  ignored there regardless).
- The new `integrations` cron is added to `vercel.json`.
- Rollback: instant rollback is safe (additive schema); rehearsed on staging.
- To do by the owner: point an uptime monitor at `/api/health`; add Sentry alert rules
  (`OPERATIONS_RUNBOOK.md`).

## 4. Real partner validation — NOT DONE

- No real enterprise organization has been onboarded; no contract has been signed in the
  product; no partner has called the API or received a webhook.
- No real access-provider adapter exists or is certified (the sandbox stands in); per-venue
  credential plumbing is ready for one. A real gate partner remains BLOCKED (Phases 23–24).
- Eterna remains a concept only; no operator data was configured.
- Real-world multi-partner validation is therefore **not claimed**.
