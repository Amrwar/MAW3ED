# Organization relationships

How a business relates to organizations in MAW3ED: three relationship
types, how they coexist, how they start, pause and end, and the rules the
database itself enforces. Permissions in detail are in
`ORGANIZATION_PERMISSIONS.md`; the platform overview is in
`ORGANIZATION_PLATFORM.md`.

## The three types

| Type | Meaning | Example | Operational access | Public directory |
|---|---|---|---|---|
| **OWNED** | The organization owns or legitimately controls the business | A restaurant group's five brands; a clinic company's clinics | Only the scopes the business granted — owning on paper grants nothing by itself | Listed |
| **HOSTED** | An independent business trades at the organization's place | A barbershop in Eterna Mall | **Never.** No scope can be granted (refused by the code and by a database constraint) | Listed |
| **MANAGED** | An outside company runs selected functions under delegation | An operator handling bookings for three restaurants | Only the scopes granted, optionally until an expiry date; finance cannot be delegated | Not listed (back office) |

The pre-2026-10-31 labels were migrated by meaning: `TENANT` and
`PARTNER` → HOSTED, `FRANCHISE` → MANAGED. Older clients may still send
them; the API maps them the same way. New rows never carry them.

## One business, many relationships — no duplicates

```
                 Restaurant ABC  (one Business row; one owner account;
                 │                its customers, staff, services,
                 │                bookings and subscription — once)
   ┌─────────────┼──────────────────────┐
 OWNED         HOSTED                 MANAGED
 Group X       Eterna Mall            Operations Co. Y
 scopes:       (listing only)         scopes: RESERVATIONS
 REPORTS,                             until 2027-01-31
 FINANCE
```

Each relationship is its own `OrganizationBusiness` row. Nothing about
the business is copied. Each organization's people get exactly their own
row's grant; the grants of different organizations add up only for a
person who belongs to more than one of them.

## Lifecycle

```
organization invites ─► INVITED ──business accepts (and grants)──► APPROVED
                          │   └──business declines──► DECLINED
business requests ─► REQUESTED ──organization approves──► APPROVED
  (granting up front)     └──organization rejects──► REJECTED

APPROVED ──either side pauses──► SUSPENDED ──the SAME side resumes──► APPROVED
APPROVED / SUSPENDED / INVITED ──organization removes──► REMOVED
APPROVED / SUSPENDED / REQUESTED ──business leaves──► REMOVED
```

- **Type is fixed at creation.** A different relationship is a new row
  the business approves; nobody relabels a hosted tenant as owned.
- **Scopes are the business's alone.** The organization may *ask*
  (`requestedScopes`); the business owner grants on acceptance and can
  narrow, widen or withdraw everything (`scopes: []`) at any time.
- **Pause belongs to whoever paused.** An organization cannot undo a
  business's pause of its access.
- **Removal deletes nothing** but the relationship: the business, its
  bookings, customers and money are untouched.
- Every transition is conditional on the state it leaves (two people
  deciding at once cannot both win) and audited.

## Rules the database enforces

`prisma/migrations/phase22c_relationships.sql`:

| Rule | Constraint |
|---|---|
| A hosted relationship carries no scopes | `OrganizationBusiness_hosted_no_scopes_chk` |
| Finance only to an owner | `OrganizationBusiness_finance_owned_chk` |
| A branch-limited relationship can only run that branch's reservations | `OrganizationBusiness_branch_scopes_chk` |
| One live row per organization, business, branch and type | `OrganizationBusiness_live_rel_key` (partial unique) |
| At most one owning organization per business | `OrganizationBusiness_one_owner_key` (partial unique) |
| No organization is its own parent | `VenueOrganization_not_own_parent_chk` |
| No hierarchy cycle; at most three levels | trigger `VenueOrganization_parent_guard` (serialized by an advisory lock) |

The application checks the same rules first, under a per-business
advisory lock, to give a clear message; the database is the backstop.

## Organization hierarchy

An organization may sit under one parent (a holding company over a
mall). Linking requires owning **both** organizations (or the platform);
unlinking requires owning either. Cycles and a fourth level are refused
by the trigger. A parent does **not** inherit its children's delegations:
operating a business always needs that business's own grant to the
organization that holds it. Public pages show one level each way (parent,
direct children); nothing traverses the tree.

## Where the code is

- `src/lib/organizations/scopes.ts` — types, scopes, what each relationship may carry (shared with the screens)
- `src/lib/organizations/associations.ts` — the state machine, one-owner and overlap rules, hierarchy
- `src/lib/organizations/delegation.ts` — what a person may do in a business, the acting context
- `src/app/api/organizations/**`, `src/app/api/business/organizations/**` — the two sides' routes
