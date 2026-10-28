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
| 18 | Awaiting instructions | NOT STARTED |
| 19 | Awaiting instructions | NOT STARTED |
| 20 | Awaiting instructions | NOT STARTED |
| 21 | Awaiting instructions | NOT STARTED |
| 22 | Awaiting instructions | NOT STARTED |
| 23 | Awaiting instructions | NOT STARTED |
| 24 | Awaiting instructions | NOT STARTED |
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
