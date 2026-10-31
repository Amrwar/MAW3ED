# Master roadmap

## Vision

The most reliable and polished booking and business-management
platform for its market (Egypt first: EGP, Africa/Cairo, Arabic-first
with English), growing from appointments into:

1. Business discovery
2. Restaurant and service reservations
3. Customer management
4. Multi-branch business operations
5. Malls and commercial destinations
6. Compound visitor authorization
7. Authorized third-party QR / gate access
8. Mobile experiences
9. Enterprise multi-venue administration

The first proposed venue integration is **Eterna Mall**, inside an
Emaar compound in Egypt. Nothing will be built that simulates Emaar's
approval or bypasses a gate. Gate access stays BLOCKED until there is a
written agreement and a technical specification from the operator.

Where each area stands today: `FEATURE_INVENTORY.md`.

## Phase numbering: read this first

The git history already uses **Phase 17 to Phase 34** (PR #1, "Phase
17 remediation", through PR #25, "Phase 34: mobile performance"). The
new programme also calls its phases 17–28. The numbers collide.

To keep reports unambiguous:

- **Historical phases** (already merged) are written `H17`–`H34` in
  these documents. Their record is the PR history and the
  `docs/qa-*.md` files.
- **Programme phases** (this roadmap) are written `Phase 17`–`Phase 28`,
  and their reports go in `docs/phases/PHASE_XX_REPORT.md`.

If the owner prefers a different scheme (for example, renumbering the
programme from 35), change it here before Phase 17 starts.

## Programme phases

Each phase's scope is set by its instructions when they arrive. Nothing
below is planned in detail yet, and no phase starts automatically.

| Phase | Scope | Status |
|---|---|---|
| Baseline | Repository inspection, roadmap and verification documents, CI repair | Done — `docs/phases/BASELINE_REPORT.md` |
| 17 | Production audit and remediation | PARTIAL — code complete, awaiting merge + migration (`docs/phases/PHASE_17_REPORT.md`) |
| 18 | Premium UI/UX and unified booking system | PASS — code complete, awaiting merge + migration (`docs/phases/PHASE_18_REPORT.md`) |
| 19 | Production booking and payment reliability: state machine, concurrency, time zones, payments, notification outbox, runbooks | PASS (code complete, locally verified; merged #35) — `docs/phases/PHASE_19_REPORT.md` |
| 20 | Security, privacy and operational hardening: threat model, revocable sessions, recycled-number fence, CSRF and upload checks, export, audit, legal drafts, restore drill | PASS (code complete, locally verified; 14 residual risks with owners) — `docs/phases/PHASE_20_REPORT.md`, `docs/security/SECURITY_REPORT.md` |
| 21 | Business onboarding and SaaS maturity: server drafts, readiness gate, private-until-published, owner test bookings, separate verification states, policies, entitlements, demo, CSV import, help centre, lifecycle funnel | PASS — merged #39, live 2026-10-30 — `docs/phases/PHASE_21_REPORT.md` |
| 22 | Multi-venue and destination architecture: organisations, compounds, venues, zones, gate metadata, visitor policies, tenancy approval, venue roles, venue console, public venue pages | PASS — merged #40, live 2026-10-31 — `docs/phases/PHASE_22_REPORT.md`, `docs/architecture/VENUES.md` |
| 22b | Organization platform (generic malls, compounds, business groups): self-registration with platform review, profiles, members, approved associations (invite by slug, request to join, email invite into onboarding), public directories under `/groups`, marketing link + QR, booking attribution, organization console and admin review | PASS — merged #43, live 2026-10-31 — `docs/phases/PHASE_22B_REPORT.md`, `docs/architecture/ORGANIZATION_PLATFORM.md` |
| 22 final | Organization relationships: OWNED / HOSTED / MANAGED, delegated management (scopes, branch limits, expiry, revocation) through the regular dashboard, one owner per business, parent organizations without cycles | PARTIAL (code complete, locally verified; not deployed) — `docs/phases/PHASE_22_REPORT.md`, `docs/architecture/ORGANIZATION_RELATIONSHIPS.md`, `docs/architecture/ORGANIZATION_PERMISSIONS.md` |
| 23 | Booking check-in QR, optional visitor-pass module, provider-neutral gate adapter with a sandbox provider (`docs/roadmap/UPDATED_PHASES_22_24.md`) | NOT STARTED |
| 24 | Launch testing with a first real organization configured as data (no code names a partner); external gate hardware remains a separate milestone gated on a written agreement | NOT STARTED |
| 25 | Awaiting instructions | NOT STARTED |
| 26 | Awaiting instructions | NOT STARTED |
| 27 | Awaiting instructions | NOT STARTED |
| 28 | Awaiting instructions | NOT STARTED |

## Dependencies already visible

These follow from the baseline. They do not set the order of phases.

- **Malls, compounds and multi-venue admin** need a level above
  `Business` (a venue or organisation) that does not exist yet. That is
  a schema change touching tenant isolation, admin RBAC and discovery,
  so it should come before any mall or compound feature.
- **Multi-branch operations** need services, staff and opening hours
  scoped to a branch (today they are business-wide), and a
  branch-manager role.
- **Anything that takes money** inherits the open Paymob item: no real
  payment has succeeded yet (`docs/payments-verification.md`).
- **Mobile releases** need the store accounts, signing, and a passing
  Maestro run (the last run on `main` failed).
- **Every schema change** goes through the manual SQL migration process
  (`ARCHITECTURE_OVERVIEW.md` → Database migrations). The roadmap would
  benefit from a migration ledger table, or a pre-deploy check that the
  code's required migrations are present, before larger schema work.
- **There is no staging environment** recorded in the repository.
  "Staging verified" cannot be reported for any phase until one exists.
