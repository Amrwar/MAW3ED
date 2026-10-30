# Phase 22 report: multi-venue and destination architecture

Date: 2026-10-31. Branch `phase-22-venues`, on `main` after PR #39
(Phase 21, live). Migration: `prisma/migrations/phase22_venues.sql` —
**run it on production before this code deploys.** Model, hierarchy and
permission matrix: `docs/architecture/VENUES.md`.

## Foundations verified from Phases 17–21

| Foundation | State |
|---|---|
| Booking engine, overlap constraints, idempotency (17, 19) | In place; reused unchanged — venue pages link to each business's own booking page |
| Notification outbox (19) | Unchanged; venues send nothing |
| Revocable sessions, origin check, route-guard test, audit helper (20) | Reused: every new route is guarded and listed in the route-guard test; venue changes are audited |
| Readiness, private-until-published, test bookings (21) | Respected: a venue lists only published businesses; venue metrics exclude test bookings |
| Phase 17–21 production migrations | All applied and verified on production (Phase 21 twice, 2026-10-30) |

## How this phase was run

1. Inspected `Business`, `Branch`, `City`, `Neighborhood`, `Category`,
   the admin roles and permissions, the dashboard guard, discovery, the
   sitemap and the booking widget before designing anything.
2. Extended rather than duplicated: `Neighborhood` serves as the
   district level, `Branch` stays the unit that is placed in a venue, the
   admin permission system gains two permissions, the audit log records
   venue changes.
3. Pure functions first (permission matrix, rules, FAQ, access window,
   location path, directory filters, SEO), then the database code with a
   Postgres test, then routes and screens, then an HTTP script against a
   production build.
4. An independent code review of the whole diff; findings and what was
   done about each are at the end.

## Existing functionality discovered (verified, kept)

- Location: `City` → `Neighborhood` (district) → `Business`, with an
  optional pin; `Branch` with its own address and pin, carrying bookings,
  blocks and resources.
- Roles: platform `AdminRole` (MODERATOR / ADMIN / SUPER_ADMIN) with an
  action-named permission matrix; business owner vs staff
  (`lib/business-access.ts`).
- No venue, compound, operator, gate or visitor model existed.

## Changes implemented

**A. Domain.** `VenueOrganization`, `Compound`, `Venue`, `VenueZone`,
`VenueGate` (metadata; venue or compound), `VenueHours`, `VenuePolicy`,
`VenueException`, `VenueMembership` (tenancy with approval), `VenueRole`
(organisation / compound / venue scope). No change to `Business`,
`Branch` or `Booking` columns.

**B. Hierarchy.** Country (`City.countryCode`) → city → district →
compound → venue → zone → branch → services; every level below city is
optional and no existing business is placed anywhere.

**C. Administration.** Platform admin (`/admin/venues`): create
operators, compounds, venues (always DRAFT), activate / publish /
suspend, grant and revoke roles to existing accounts. Venue console
(`/venue-admin`): details, hours, floors/zones, gates (compound gates
only with compound authority), visitor policy, dated exceptions,
approve / reject / remove / place tenants, counts-only metrics. Owners
(`/dashboard/venue`): ask for the business or a branch to be listed,
see the decision, withdraw or leave. Venue managers with no business
land on their console after sign-in.

**D. Public experience.** `/venues` and `/venues/[slug]` in Arabic and
English: location path, open now, directions, directory with search /
category / floor filters and booking links (preselecting the branch),
floors, hours, notices, visitor and access information, a FAQ generated
only from the venue's policy, and a fixed notice that the information
comes from the venue's management and that Maw3ed issues no entry
passes. Business pages say which public venue they are in. Venues with
listings are in the sitemap; an empty venue renders but is `noindex`.
Public API: `/api/public/venues`, `/api/public/venues/[slug]`.

**E. Policies.** Visitor eligibility (open / booking required /
operator-managed / closed), access window before and after, guests per
booking, re-entry, allowed entry points, instructions in both languages,
dated exceptions. Configuration and published information only; no
gate authorisation is implemented.

**F. Migration.** Additive and idempotent; `City.countryCode` defaults to
`EG`; constraints the schema language cannot express (one live
membership per venue/business/branch, one role scope, one gate owner,
day and range checks) are in the SQL. Applied twice to the QA database.

## Database changes

See `docs/architecture/VENUES.md` § Data model. New: 10 tables, 8 enums,
1 column (`City.countryCode`). Changed: none.

## Tests executed

All on 2026-10-31, on the final code, against the local QA database
(`maw3ed-qa`, migration applied twice) and a production build on :3101.

| Suite | Result |
|---|---|
| Web typecheck | PASS |
| Web lint | PASS — 0 errors, 6 warnings (same 6 as `main`) |
| Production build | PASS — `/venues`, `/venues/[slug]`, `/venue-admin`, `/venue-admin/[id]`, `/admin/venues`, `/dashboard/venue` and 17 new API routes built |
| Unit + route tests (`npx vitest run`) | PASS — 1082 passed, 94 skipped (1176; 108 files). Phase 21: 1059 |
| Same with Postgres | PASS — 1142 passed, 34 skipped |
| New unit tests: `access.test.ts` (8: scopes, null scopes, widest authority, platform-only actions, nobody else, compound gates), `rules.test.ts` (17: access window, FAQ claims, open-now incl. overnight and exceptions, location path, input rules incl. impossible dates and non-web links, directory filters, ar/en SEO and noindex, directions); route-guard test extended | PASS |
| `src/lib/venues/phase22.db.test.ts` (Postgres, 15): organisation with two venues; draft/suspended not public; request → approve onto a floor → listed → unpublished business hidden → removed → may ask again; zone from another venue refused; another venue cannot decide; double approval refused; owner restricted to own branches and requests; several branches must name one; whole-business and branch rows cannot overlap; rejected request blocked for a week; draft and suspended venues take no requests; roles from the DB reach only their scope; DB refuses wrong role scope and two-owner gates; metrics are counts only, exclude test bookings and pre-approval bookings, isolated per venue; single-location branch counts unbranched bookings; booking with no venue unchanged; public gates filtered and codes never exposed; every city has a country and no existing business was placed in a venue | PASS — 15/15 |
| `scripts/qa-phase22.mjs` (HTTP, real sessions): admin builds operator, compound, two venues (draft, inherits compound city/operator; duplicate slug 409; others 404); role refused to an unverified account, granted after confirmation, refused for unknown accounts; manager sees only their venue, other venue 404, owner 404, anonymous 401; edits details and hours, adds floor and gate; renaming a gate changes nothing else; compound gate refused; policy set; foreign gate refused; impossible date 422; notice published; cannot publish or appoint; draft not public; cannot publish before activation; empty venue renders `noindex`, no gate codes, instructions and no-pass notice shown; owner must pick a branch, asks, cannot ask twice, pending not public, cannot approve; other venue's manager cannot decide either way; manager approves onto a floor; Arabic page lists the branch with `?branch=`; ar/en metadata, canonical, hreflang; FAQ from policy; no authorisation claims; search filters; business page says where it is; index lists it; public API without codes; other venue empty; metrics and tenant list carry no customer data; console, admin and owner pages render, owner gets 404 on the console; removal takes it off the venue and the business page; existing URLs unaffected; suspension takes the venue down | PASS — 56/56 (final build) |
| Accessibility: `qa-phase18.mjs` now includes `/venues`, `/dashboard/venue`, `/admin/venues` | PASS — 400 page loads, 0 serious/critical axe violations, 0 overflow; only the deliberate 404 page logs its 404, as in Phase 18 |
| Accessibility on a filled venue page (temporary venue with a listed business, floors, gate, policy, notice), ar/en × 375/1440 | PASS — 4/4, 0 violations, 0 overflow |
| Migration applied twice to QA | PASS — second run changes nothing |

### Tests NOT RUN / BLOCKED

- Production and staging: no staging environment; the migration has not
  been run on production (owner action).
- Any gate or visitor-access integration: BLOCKED — there is no operator
  agreement or API; nothing was built or simulated.
- Mobile app: no mobile change; not run.

## Regression results

Every earlier QA script passed against this phase's final production
build: Phase 17 13/13, Phase 19 21/21, Phase 20 19/19, security probes
32/32, booking journeys 19/19, Phase 21 44/44. The booking widget gained
one optional input (`?branch=` preselection); it is ignored unless it
names an active branch of the business, and the server checks the
branch again when booking.

## Security findings

Found and fixed in this phase (none reached production):

- **Venue role to an unverified account** (review, medium): anyone can
  sign up with an address they do not own; a grant to it would hand a
  stranger the venue. Grants now require a confirmed email (409
  otherwise).
- **Partial updates reset fields** (review, medium): renaming a
  deactivated gate turned it back on. Updates now apply only the fields
  sent.
- **Venue saw the whole chain** (review, low): a whole-business
  membership counted every branch's bookings. A business with several
  branches must now join by branch.
- Tenant isolation, privilege boundaries and public data were checked
  by the reviewer and by the HTTP script (above); every new API route is
  in the route-guard test.

Residual, by design and documented: venue managers' edits to a
published venue's text go live without platform review (audited);
venue notices do not block bookings.

## Performance findings

- The public venue page is two queries (venue with zones, hours,
  policy, exceptions and approved memberships; then gates).
- Venue metrics are one `groupBy` over bookings filtered by the
  approved tenants (indexed on `businessId`); fine for a venue with tens
  of tenants. Not measured beyond QA.
- Nothing new runs on the booking path; the company page adds one small
  query for its venues.

## Known limitations

- No visitor pass is issued and no gate is opened. The policy, gate
  metadata and `accessWindow()` are ready for a separate service once an
  operator provides a written agreement and an integration spec.
- Venue opening hours are informational; booking availability still
  follows each business's own hours. A venue CLOSED exception does not
  block bookings.
- Venue roles are granted to existing accounts only; there is no
  invitation email.
- Venue pages have no images upload UI yet (cover/logo accept URLs via
  the API).
- The mobile app does not show venues yet (the public API is ready).

## Remaining work

- Owner: run `prisma/migrations/phase22_venues.sql` on production before
  the deploy.
- Operator data for Eterna (names, floors, gates, hours, instructions,
  managers' accounts) to enter it — entered by a platform admin, then
  published.
- Not built: visitor passes and gate integration (needs an operator
  agreement and API), venue images upload UI, invitations for venue
  managers, review of venue text edits before they go live, venues in
  the mobile app, venue notices that pause bookings.

## Release readiness

Ready to merge once the migration has run on production. Additive: with
no venues created, the site behaves exactly as before (new pages are
empty and `noindex`). Not verified on staging or production.

## Next phase dependencies

- Run `phase22_venues.sql` on production before deploying.
- Representing Eterna needs the operator's data: names, floors, gates,
  hours, access instructions, and the people who will manage it.
- Any gate or visitor-access integration needs a written agreement and
  API specification from the operator (Emaar). Nothing here simulates
  their approval.

## Code review of this phase's changes

An independent review of `git diff main...HEAD` found no high-severity
issue and confirmed isolation, escalation boundaries, public data
filtering, the state machine and the migration. Its 12 findings, all
addressed:

| # | Finding | Fix |
|---|---|---|
| 1 | Role could be granted to an unverified email account | Confirmed email required (409 `email-not-verified`); QA asserts it |
| 2 | Zone/gate PATCH reset unsent fields (zod defaults in `.partial()`) | Only sent fields are applied (`sentOnly`); QA asserts a rename keeps a gate inactive |
| 3 | Branch membership of a single-location business counted nothing | Its unbranched bookings are counted; DB test |
| 4 | Whole-business membership exposed chain-wide volume | Businesses with several branches must join by branch (`pick-a-branch`) |
| 5 | Sitemap could list a `noindex` page; `/venues` left out | Listing excludes inactive branches; `/venues` in the sitemap when any venue lists a business |
| 6 | "Located in" ignored inactive branches and could duplicate; directory duplicates | Filtered and de-duplicated; whole-business and branch rows can no longer coexist (`overlaps-existing`) |
| 7 | "Open now" ignored closures and special hours | Applied (`hoursWithExceptions`); unit test. Notices still do not block bookings (documented) |
| 8 | Requests to drafts and inactive branches; unlimited re-requests after rejection | Only ACTIVE venues and active branches; a rejected request waits a week (`recently-rejected`) |
| 9 | `javascript:` website accepted; edits go live unreviewed | Website must be http(s); unreviewed edits documented as a limitation |
| 10 | Impossible dates, unknown operator ids and racing hour edits gave 500 | 422 for invalid dates and references, 409 for conflicts; hours saved by upsert |
| 11 | Moving a venue between compounds left a mismatched operator and stale gates | Operator follows the compound unless named; stale gate ids are dropped from the policy |
| 12 | Arabic "official website" label | Now "الموقع الإلكتروني" |
