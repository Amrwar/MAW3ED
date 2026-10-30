# Destinations: compounds, venues and tenancy (Phase 22)

How Maw3ed represents malls, gated compounds, office complexes, business
parks and mixed-use developments, and who may do what with them.

Nothing in the code names a particular operator. A destination such as
Eterna — a mall inside an Emaar compound — is **data** a platform
administrator enters from what the operator supplies; it is not
hard-coded, and creating it implies no partnership. Maw3ed does not open
gates or issue entry passes.

## Location hierarchy

```
Country (City.countryCode, "EG" for every existing city)
  └─ City
       └─ District (the existing Neighborhood model)
            └─ Compound            (optional)
                 └─ Venue          (optional; may also sit directly in a city/district)
                      └─ Zone/floor (optional)
                           └─ Business branch, or the business as a whole
                                └─ Services (unchanged)
```

- A business is **never required** to be in a venue. Every business that
  existed before Phase 22 stays exactly where it was.
- A venue may be in a compound or not; a compound may hold several
  venues; an organisation may run several compounds and venues.
- A business is placed in a venue only through an **approved
  `VenueMembership`**, for the whole business or for one branch. A
  business with several branches can have each in a different venue.
- `locationPath()` in `src/lib/venues/rules.ts` builds the path for any
  place, leaving out levels it does not have.

## Data model

| Model | Purpose | Key rules |
|---|---|---|
| `VenueOrganization` | An operator (developer, mall operator) | Supplied by the operator; implies no partnership |
| `Compound` | A gated development in a city/district | Optional organisation |
| `Venue` | A mall, office complex, business park… | `status` DRAFT → ACTIVE → SUSPENDED; public only when ACTIVE **and** `isPublished`; created as DRAFT |
| `VenueZone` | Floor, zone or wing | Belongs to one venue |
| `VenueGate` | An entry point, **metadata only** | Belongs to a venue **or** a compound (CHECK constraint); `code` is the operator's id and is never public |
| `VenueHours` | The venue's own opening hours | One row per day (unique, 0–6 CHECK); each business keeps its own hours |
| `VenuePolicy` | Visitor eligibility, access window, guests, re-entry, allowed gates, published instructions | Configuration only — authorises nothing |
| `VenueException` | Dated closure, special hours, access suspension, booking pause | Shown publicly; cancels nothing |
| `VenueMembership` | A business/branch listed in a venue | REQUESTED → APPROVED / REJECTED, APPROVED → REMOVED; one live (REQUESTED/APPROVED) row per venue + business + branch (partial unique index); a business with several active branches joins by branch; the whole business and one of its branches cannot both be live in one venue |
| `VenueRole` | A person's authority over part of a destination | ORGANIZATION_ADMIN / COMPOUND_ADMIN / VENUE_MANAGER, exactly one matching scope (CHECK constraint) |

Migration: `prisma/migrations/phase22_venues.sql` — additive and
idempotent; it adds `City.countryCode` (default `EG`) and new tables only.

## Permission matrix

Authority over a venue comes from exactly one source (`src/lib/venues/access.ts`):

| Action | Platform admin (`venues.manage`) | Organisation admin | Compound admin | Venue manager | Business owner | Business staff | Customer |
|---|---|---|---|---|---|---|---|
| Create organisation / compound / venue | ✔ | — | — | — | — | — | — |
| Activate, publish, suspend a venue | ✔ | — | — | — | — | — | — |
| Grant or revoke venue roles | ✔ | — | — | — | — | — | — |
| View the venue console | ✔ | ✔ own org's venues | ✔ venues in own compound | ✔ own venue | — | — | — |
| Edit venue details and hours | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Manage zones/floors | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Manage the venue's gates | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Manage the compound's gates | ✔ | ✔ | ✔ own compound | — | — | — | — |
| Visitor policy and exceptions | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Approve / reject / remove / place a tenant | ✔ | ✔ | ✔ | ✔ | — | — | — |
| View venue metrics (counts only) | ✔ | ✔ | ✔ | ✔ | — | — | — |
| Ask to be listed; withdraw; leave | — | — | — | — | ✔ own business/branches | — | — |
| See a published venue and its approved directory | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

What **no venue role** can see: customers, their names, phones, emails,
notes (which may contain health details), the services they booked,
prices, payments or reviews. Venue metrics are booking counts by status
at approved tenants, from the date each tenant was approved, excluding
owners' test bookings; a branch membership counts that branch (and, for
a single-location business, its bookings that carry no branch)
(`src/lib/venues/metrics.ts`). A venue manager
does not gain any access to a tenant business's dashboard.

Enforcement: every venue route calls `requireVenueAccess()`
(`src/lib/venues/guard.ts`), which reads roles from the database on each
request and answers **404** for no access, so drafts and other venues are
not discoverable. Every id from the request (zone, gate, exception,
membership) is matched together with the venue id; a zone or gate from
another venue is refused. All changes are written to `AuditLog` with the
authority they were made under.

## Approval flow

1. A platform administrator creates the operator, compound and venue
   (DRAFT, private) and grants venue roles to existing accounts **whose
   email is confirmed** (an unconfirmed address could belong to anyone).
2. The venue's managers fill in details, hours, floors, gates, the
   visitor policy and instructions.
3. A platform administrator activates and publishes the venue.
4. A business owner asks, from **Dashboard → Mall or complex**, for the
   business — or, when it has several branches, the branch inside — to be
   listed. Only an ACTIVE venue takes requests (published or not, so
   tenants can join before launch); only active branches qualify; a
   request the venue rejected cannot be re-sent for seven days.
5. A venue manager approves (optionally onto a floor and unit), rejects
   or later removes it. The owner can withdraw at any time.
6. The public page lists only APPROVED tenants whose business page is
   itself published.

## Public experience

`/venues` and `/venues/[slug]` (Arabic and `/en/…`): venue information,
location path, open-now, directions, the directory with search, category
and floor filters, booking links to each business page (with `?branch=`
when listed by branch), floors, hours, notices, visitor and access
information from the policy, a FAQ generated only from the policy, and a
fixed notice that the information comes from the venue's management and
that Maw3ed issues no entry passes. A venue with an empty directory
renders but is `noindex` and stays out of the sitemap. The public API is
`/api/public/venues` and `/api/public/venues/[slug]`.

## Visitor access: the boundary for a separate service

Not built. The schema and helpers are shaped so a separate service can be
added once an operator supplies a written agreement and an integration
specification:

- **Input it can read:** `VenuePolicy` (eligibility, `accessBeforeMinutes`,
  `accessAfterMinutes`, `maxGuestsPerBooking`, `reentryAllowed`,
  `allowedGateIds`), `VenueGate.code` (the operator's own gate ids),
  `VenueException` (ACCESS_SUSPENDED), and the booking.
- **The calculation it can reuse:** `accessWindow(booking, policy)` in
  `src/lib/venues/rules.ts` — the window and head-count a booking would
  imply, or null. It is a calculation, not an authorisation.
- **What it would add:** its own store of issued passes, the operator's
  API client, revocation on cancellation, and its own audit trail —
  outside the booking engine, so a gate integration failing can never
  fail a booking.
- **What stays true:** no pass is issued from the booking flow; the
  public pages never claim one is.
