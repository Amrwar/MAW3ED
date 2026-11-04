# Enterprise architecture

Phase 28. Maw3ed serves many independent organizations — malls, compounds, business groups,
restaurant and clinic groups, franchise operators — on one platform, with no code or
configuration per organization. This document is the map; the details live in the linked
files.

## The model

```
Organization (VenueOrganization)          ← registers itself, approved by the platform
 ├─ parent? (≤ 3 levels, no cycles: trigger organization_parent_guard)
 ├─ VenueRole: ORGANIZATION_OWNER / ORGANIZATION_ADMIN (members)
 ├─ OrganizationBusiness (one row per relationship)
 │    relation: OWNED | HOSTED | MANAGED
 │    status:   INVITED → APPROVED (business accepts) | DECLINED | SUSPENDED | REMOVED
 │    scopes:   what the business granted (RESERVATIONS, CUSTOMERS, SERVICES, STAFF,
 │              RESOURCES, SCHEDULES, PROFILE, REPORTS, FINANCE) — never on HOSTED (DB CHECK)
 │    branchId: whole business, or one branch
 ├─ Venue(s) → access provider (per venue) + VenueAccessCredential (per venue)
 ├─ OrganizationContract (platform-set limits; no prices)
 ├─ ApiClient(s) → ApiUsageDay
 └─ WebhookEndpoint(s) → WebhookDelivery
Business ── its own plan and subscription (Business.plan); an organization never owns it
```

- **Independent organizations** are rows, not deployments. A second (or hundredth)
  organization is provisioned through the same APIs (`docs/enterprise/ONBOARDING.md`);
  `scripts/qa-phase28.mjs` provisions two and checks every boundary.
- **One business, several relationships.** A tenant can be HOSTED by a mall and MANAGED by a
  group. Partial unique indexes allow one live row per (organization, business, branch,
  relation) and at most one whole-business OWNED owner (`phase22c_relationships.sql`).
- **Tenant subscriptions stay the business's own.** A mall hosting a business never reaches
  its plan, payments, customers or loyalty. Owned brands may share FINANCE, which shows their
  plan in the organization console (read-only).

## Boundaries (who sees what)

The rule is one function per surface, shared by the console, the API and webhooks
(`docs/enterprise/PERMISSION_MATRIX.md`):

| Surface | Rule | Code |
|---|---|---|
| Console pages and APIs | caller's org authority (PLATFORM / OWNER / MANAGER) × action | `lib/organizations/access.ts`, `guard.ts` |
| Operating a business | delegation: OWNED/MANAGED + granted scopes, branch-limited | `lib/organizations/delegation.ts`, `lib/business-access.ts` |
| Enterprise API and webhooks | API key's scopes × relationship × granted scopes | `lib/enterprise/auth.ts`, `visibility.ts` |
| Reports | counts where REPORTS is shared; money only with FINANCE | `lib/organizations/portfolio.ts` |

Bookings leave the platform (API, webhooks) only for OWNED or MANAGED businesses that granted
RESERVATIONS, and never with the customer's name, phone or email.

## Enterprise integrations

- **API** — `/api/v1/*`, read-only, versioned in the path. Scoped API keys (only a SHA-256 is
  stored), bound to an organization with an APPROVED status and a contract in force; per-key
  rate limit from the contract; cursor pagination (`limit` ≤ 100). See
  `INTEGRATION_GUIDE.md`.
- **Webhooks** — events come from a bounded change feed (`(updatedAt, id)` cursor per
  endpoint, 200 bookings per run), queued once per `(endpoint, eventId)`, signed with
  HMAC-SHA256, retried with backoff and abandoned after 8 attempts; an endpoint is switched
  off after 20 failures in a row. Every send re-checks the address (SSRF).
- **Secrets** — webhook secrets and venue credentials are sealed (AES-256-GCM) under their own
  HKDF purpose keys (`lib/access/crypto.ts`); a sealed value of one purpose cannot be opened
  as another. API keys are hashed, not sealed.

## Provider isolation (venue access)

Each venue chooses its provider (platform-approved) and keeps its own credential
(`VenueAccessCredential`, one per venue). Every provider call for a pass carries that venue's
credential only (`CallContext.venueCredential`); revoking or rotating venue A's credential
stops or changes only venue A's calls. Sync jobs are per credential with their own leases,
bounded retries and DEAD state, so an outage answering for venue A's site leaves venue B's
jobs running. (Proved: `phase23.db.test.ts` "P28", `qa-phase28.mjs` "providers".) No real
partner adapter exists yet — the sandbox stands in; a partner adapter must authenticate with
`ctx.venueCredential`.

## Contracts (enterprise billing)

`OrganizationContract` records what the platform agreed: maximum API keys, webhooks and
requests per minute, start and end. **No prices** — the commercial terms are the signed
agreement named by `reference`. Usage is accounted per key per day (`ApiUsageDay`). Ending a
contract stops the organization's keys (403) and webhooks at once; nothing is deleted.
Business subscriptions are unchanged (per business: Paymob or Stripe, `docs/payments-stripe.md`).
Payment reconciliation: `/api/admin/payments/reconciliation` (`lib/payments/reconcile.ts`).

## Operations

- Every cron run is recorded (`CronRun`); `/api/health` reports database, job freshness
  against each job's allowance, and queue depths (`OPERATIONS_RUNBOOK.md`).
- Feature flags: `FEATURE_FLAGS_OFF` (env) switches off `enterpriseApi`, `webhooks`,
  `automations`, `waitlist` without a code change.
- Cron jobs, each bounded per run: reminders, notifications, subscriptions, operations,
  access (30 s budget), integrations (50 deliveries / 25 s).
