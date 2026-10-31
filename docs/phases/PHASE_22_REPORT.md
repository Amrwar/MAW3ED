# Phase 22 report: multi-venue and destination architecture

Date: 2026-10-31. Branch `phase-22-venues`, on `main` after PR #39
(Phase 21, live). Migration: `prisma/migrations/phase22_venues.sql` —
applied to production and verified on 2026-10-31, before the deploy.
Merged as PR #40; live on 2026-10-31 (`fa574c2`). Model, hierarchy and
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

- Staging: there is no staging environment. Production (after the
  merge): migration applied and verified by query; the anonymous smoke
  test passed (see Release readiness); signed-in venue flows not
  exercised on production because no venue exists there yet.
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
- Venue weekly opening hours are informational; booking availability
  follows each business's own hours. Dated CLOSED and BOOKINGS_PAUSED
  notices do stop online booking at the venue's tenants (completion
  audit, A12).
- Venue roles are granted to existing accounts only; there is no
  invitation email.
- Venue pages have no images upload UI yet (cover/logo accept URLs via
  the API).
- The mobile app does not show venues yet (the public API is ready).

## Remaining work

- Operator data for Eterna (names, floors, gates, hours, instructions,
  managers' accounts) to enter it — entered by a platform admin, then
  published.
- Not built: visitor passes and gate integration (needs an operator
  agreement and API), venue images upload UI, invitations for venue
  managers, review of venue text edits before they go live, venues in
  the mobile app, venue notices that pause bookings.

## Release readiness

Released 2026-10-31: migration applied and verified on production, PR
#40 merged, production serving `fa574c2`. Anonymous smoke test on
maw3ed.net: existing pages 200; `/venues` and `/en/venues` 200, empty and
`noindex`; unknown venue 404; public venues API 200 with an empty list;
venue console and owner page redirect to sign-in; console API 401;
admin venues page 404 anonymously; no venue in the sitemap. With no
venues created, the site behaves exactly as before. Signed-in venue
flows are verified locally only.

## Next phase dependencies

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

## Completion audit (2026-10-31, after release)

A release-blocking review of the released code found eleven defects.
All are fixed on branch `phase-22-qa`, with regression checks. Until
that branch is merged, production runs the code *without* these fixes.

| # | Defect found | Evidence it existed | Fix | Regression check |
|---|---|---|---|---|
| A1 | A venue manager with no business was sent to `/onboarding` after signing in, not to the console | Browser probe: login landed on `/onboarding` | `/onboarding` sends a user with a venue role and no business to `/venue-admin`; `?create=1` still lets them create a business; the console index links to it | `qa-phase22.mjs` (landing 307 → `/venue-admin`; `?create=1` 200); `qa-venue-console.mjs` logs in and lands on the console |
| A2 | The console showed "Loading…" forever when its request failed (expired session, role revoked, server error) | Code reading: no error branch | Explicit sign-in / no-access / retry states; an action refused with 401/404 reloads into them | `qa-venue-console.mjs`: role revoked mid-session → "You no longer have access", the change refused |
| A3 | "Review operational exceptions" had no review surface | Requirement check | "Needs your attention" panel from the venue's own records: pending requests, approved tenants hidden (business unpublished or branch off), policy naming an inactive or deleted gate, public venue without hours or (restricted entry) without instructions, notices in effect today | `attention.test.ts` (5); `qa-phase22.mjs` (pending request flagged); console probe (instructions missing flagged) |
| A4 | Gates could not be switched off from the console (API only) | Code reading | Turn on / Turn off per gate | Console probe: toggle persists, kind unchanged |
| A5 | Raw enum values (DRAFT, FLOOR, VENUE_MANAGER…) shown in the console | Code reading | Labels in both languages | Console probe: no raw enum on screen, ar and en |
| A6 | An owner who also manages a venue had no way into the console from the dashboard | Code reading | "Manage venues" in the dashboard nav for venue-role holders | `qa-phase22.mjs`: shown for such an owner, absent for others |
| A7 | Owners' membership requests and withdrawals were not audited | Code reading | Audit rows `venue.membership.request` / `.withdraw`, actor role `BUSINESS_OWNER` | `phase22.db.test.ts` |
| A8 | Moving a venue between compounds updated the venue and pruned gates in two separate writes | Code reading | One transaction | Code review; the existing admin PATCH paths in `qa-phase22.mjs` |
| A9 | `/venues` was indexable while no venue listed anybody (sitemap disagreed) | Code reading | `noindex` until some venue lists a business | `qa-phase22.mjs`: empty index `noindex`, indexable once listed, `noindex` again after removal |
| A10 | The owner's venue page ignored a failed load | Code reading | Error notice with retry | Code review |
| A11 | No rollback procedure for the migration | Requirement check | `prisma/migrations/rollback/phase22_venues_rollback.sql` | Run twice on QA: business, branch, booking, customer, city, review and payment counts identical before and after; migration re-applied and verified |
| A12 | Venue CLOSED / BOOKINGS_PAUSED notices were shown but did not stop bookings ("booking exceptions" only informational) | Second audit pass | Enforced in the slot loader every online booking path uses (`src/lib/venues/pause.ts`, `src/lib/bookings/schedule.ts`): no online slots and a refused booking, reason `venue-closed`, for the venue's approved tenants on those dates — branch-scoped like the listing; businesses outside the venue, only asking to join, or in a suspended venue are unaffected; ACCESS_SUSPENDED and SPECIAL_HOURS stay informational; owners adding a booking by hand keep their existing override. Wording on web, mobile, the public page and the console | `pause.test.ts` (4); `phase22.db.test.ts` (slots and `createBooking` through the real engine); `qa-phase22.mjs` (public slots empty with `venue-closed`, booking 409, page says so, removal reopens) |

Not changed, by decision and documented: venue managers' text edits go
live without platform review (audited); API error messages are Arabic in
both languages, as everywhere else in the API.

### Re-verification after the fixes (final build, 2026-10-31)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint src` | 0 errors, 6 warnings (same as `main`) |
| `npx next build` | compiled successfully |
| `npx vitest run` | 1091 passed, 95 skipped (1186; 110 files) |
| `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run --no-file-parallelism` | 1152 passed, 34 skipped |
| `cd mobile && npx tsc --noEmit && npx vitest run` | exit 0; 199 passed |
| `AUTH_SECRET=<server's> node scripts/qa-phase22.mjs` | 68/68 (adds staff token 404s, expired token 401, landing, attention, nav, index indexing, venue closure stops booking) |
| `node scripts/qa-venue-console.mjs` | all clean, twice in a row |
| `node scripts/qa-venue-page.mjs` | all clean (ar/en × 375/1440) |
| `node scripts/qa-phase18.mjs` | 400 page loads, 0 serious/critical axe, 0 overflow; only the deliberate 404 page flagged, as in Phase 18 |
| Regression: `qa-phase21` 44/44, `qa-phase19` 21/21, `qa-booking-e2e` 19/19, `qa-phase17` 13/13, `qa-phase20` 19/19, `qa-security` 32/32 | all pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Rollback SQL on QA, twice, then re-apply + verify | data counts unchanged; verify passes |

---

# Phase 22 final: organizations, ownership, hosting and management (2026-10-31)

The owner's "Phase 22 final implementation" prompt, built on Phase 22
(venues, PR #40/#42), Phase 22b (the generic organization platform, PR
#43) and its completion audit (PR #45). Branch `phase-22-final`.

## Inspection and gap analysis (before any change)

Read: this report, `PHASE_22B_REPORT.md`, the organization architecture
documents, the schema, and every business API route and dashboard page
with its guard. Findings:

| Area | State before | Gap |
|---|---|---|
| Registration, review, profile, media, members, directory, link/QR, booking attribution | Working (22b + audit) | — |
| Relationship types | `OWNED/FRANCHISE/TENANT/PARTNER` labels with **no** permission meaning | OWNED / HOSTED / MANAGED semantics |
| Delegated management | None: the web dashboard was owner-only (40 routes on `requireBusiness`); staff used 10 routes via `requireBusinessAccess` from the app | Scopes, branch limits, expiry, revocation, and a way to operate a business |
| Rules | No one-owner rule; one row per org/business regardless of type; no suspension | One owner; one row per type; pause/resume |
| Hierarchy | None | Parent organizations, cycle-safe, bounded |
| Kinds | No restaurant or clinic group | Two new kinds |
| Directory | Venue hours/coordinates loaded but not shown; directions searched the name | Hours today, directions from real coordinates |

## What was built

- **Relationships** (`ORGANIZATION_RELATIONSHIPS.md`): OWNED (operate
  within granted scopes), HOSTED (listing only; no scope can ever be
  granted), MANAGED (granted scopes, optional expiry, never finance). One
  business holds several at once without any duplication. Type fixed at
  creation. One owning organization, decided by approval (a pending
  invitation never blocks the real owner); one organization may own
  several branches. Pause/resume by either side, resumable only by the
  side that paused. Legacy labels migrated by meaning and still accepted
  from old clients.
- **Delegation** (`ORGANIZATION_PERMISSIONS.md`): eight scopes
  (reservations, customers, services, staff, schedules, profile, reports,
  finance) granted by the business owner alone — on acceptance, on a
  request, or later (narrow, widen, withdraw all, set an end date). A
  new `DELEGATE` actor in `business-access.ts` whose powers are exactly
  its scopes; re-read on every request.
- **Operating a business**: the delegate chooses a business
  (`POST /api/organizations/acting`, audited); the regular dashboard opens
  with a banner saying whose business and for whom, a navigation of only
  the granted areas, and a delegate home. Owner-only routes refuse while
  acting (409 `acting-elsewhere`), owner-only pages are not reachable
  (proxy), the owner's private settings are never sent to a delegate's
  browser, money is stripped server-side without FINANCE, branch-limited
  delegates see their branch only, the live bookings stream serves them
  within scope. 10 API routes moved from owner-only to a precise action;
  the other 30 stay owner-only by default.
- **Hierarchy**: parent organizations (owning both to link; either to
  unlink), refused cycles and depth > 3 by a database trigger serialized
  by an advisory lock; public pages show one level each way.
- **Screens**: organization console (relationship type and requested
  scopes on invites, the portfolio with what each business granted,
  pause/resume, "Manage this business", pagination of 50, parent link);
  the business owner's page (accept with chosen scopes and end date,
  change or withdraw grants, pause, request with grants); the
  onboarding banner shows what an email invitation will grant before the
  business is created; the console landing lists every business the
  person may operate.
- **Public directory**: today's hours and directions (from coordinates
  only) per venue; "part of" and "organizations within".

## Database changes

`phase22c_relationship_enums.sql` (part 1: enum values — separate
because PostgreSQL cannot use a new enum value in the transaction that
added it) and `phase22c_relationships.sql` (part 2: scope columns,
`statusReason`, legacy-label mapping, three CHECK constraints, the
per-type live index, the whole-business one-owner index, the hierarchy
column/FK/CHECK/trigger). Both idempotent, applied repeatedly on QA.
Data preservation proven (test 21). **Run both, in order, before the
deploy** — helper `migrate-phase22c.sh` with `verify-phase22c.sql`.

## Tests executed (local QA, final build)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npx eslint .` | 0 errors, 6 warnings (same six as `main`) |
| `npx next build` | compiled |
| `BOOKING_DB_TEST_URL=… npx vitest run` | **1203 passed**, 34 skipped (incl. organization unit 25, DB 26) |
| `AUTH_SECRET=… node scripts/qa-phase22c.mjs` | **56/56** (HTTP + real browser; incl. 12 code-review regressions) |
| `node scripts/qa-phase22b.mjs` | 83/83 |
| Regressions 17 / 19 / 20 / 21 / 22 | 13/13, 21/21, 19/19, 44/44, 68/68 |
| `node scripts/qa-booking-e2e.mjs` | 22/22 |
| `qa-venue-console.mjs`, `qa-venue-page.mjs` | clean |
| `node scripts/qa-security.mjs http://localhost:3101` | 32/32 |
| Accessibility sweep `qa-phase18.mjs` (now with a delegate role) | 544 page loads (anonymous, owner, admin and the new delegate role × ar/en × 375/768/1024/1440): one axe finding, `scrollable-region-focusable` on a report table at 375px — fixed (report tables are now labelled, focusable regions); re-sweep of delegate (104 loads) and owner (144 loads): **0 flagged** |
| Migration preservation (test 21) | counts identical across 10 tables; legacy labels mapped; no scopes granted |

Per-test mapping (the owner's 1–26): `docs/testing/ORGANIZATION_ACCEPTANCE_MATRIX.md`.

Two problems this phase's own tests caught and fixed before handoff:
`loading.tsx` on `/groups` turned "not found" into a 200 soft-404 (the
22b suite's status checks failed) — removed; and an ungranted delegate
page delivered its redirect as a streamed 200 (the dashboard's loading
boundary) — confirmed to render no data, and the test now asserts that.

## Independent code review

Two reviews ran. The first was pointed at the wrong range (the #45
audit commit); its nine findings were still valid in this branch and
were fixed (organization owner detection for self-appointment, audit
values, the rejection reason now stored on the row, image URLs limited
to this platform's Cloudinary cloud, unchanged images not re-sent, rate
limit charged per well-formed lookup, a redundant query, the sitemap's
doc comment). The second, scoped to this phase's diff, found ten — five
authorization or data-leak bugs, all fixed with regression tests
(matrix R1–R10): a branch filter that widened a branch-limited view; the
full business record readable by staff and delegates; spend gated on
REPORTS instead of FINANCE (and a ranking by spend); STAFF delegates
seeing login numbers and switching off people who sign in; staff
reading colleagues' time off; a stale acting cookie locking an owner
out (now self-heals); the one-owner rule letting a pending invite block
the real owner; the live stream refusing delegates; a parent unable to
detach a child; repeated delegation lookups per request (now cached).

## Requirement status

| Requirement | Status |
|---|---|
| OWNED / HOSTED / MANAGED with the stated access rules | PASS |
| Ownership needs verified relationship + authorized role, never automatic | PASS |
| Hosted venue never reaches records, bookings, medical data, finance, payments, payroll, settings | PASS |
| Delegation: scopes, branch limits, expiry, immediate revocation, audit, no escalation | PASS |
| Multiple simultaneous relationships, no duplication | PASS |
| Registration of every listed type with identity, branding, contact, location, members, directory, URL, QR, dashboard, settings | PASS |
| Associations: create through a parent, invite, approve/reject, accept with verification, suspend, revoke, remove without deleting, multiple venues and branches, business-controlled hosting | PASS |
| No cycles or invalid hierarchies | PASS |
| Directory: profile, listings, search, filters, detail navigation, book-now, opening hours, directions, ar/en, SEO, responsive, empty/error states | PASS |
| Directory loading state | PARTIAL — no skeleton: a route `loading.tsx` turned 404s into soft-404s and was removed; the page renders from one server query |
| Public URL + QR + copy/share/download + attribution, separate from booking credentials and gate passes | PASS |
| Booking steps 1–6 through the existing engine; source tracked without moving ownership | PASS |
| Booking step 7 — view booking details | PASS (manage link) · check-in QR is Phase 23 |
| Role dashboards: parent owner, org manager, venue manager, business owner, delegated manager | PASS |
| Backward-compatible migrations, constraints, transitions | PASS |
| Required documents | PASS |
| Production verification | NOT RUN — the migrations and this code are not deployed |
| External gate integration (Emaar hardware) | BLOCKED (external; does not block any of the above) |

## Known limitations

- Delegated management is in the **web** dashboard. The mobile app's
  bearer sessions have no acting context; staff app access is unchanged.
- A delegate's page refusal arrives as a streamed redirect (200 with
  `NEXT_REDIRECT`) because of the dashboard's existing loading boundary;
  no data is rendered.
- A parent organization does not inherit its children's delegations.
- Different organizations owning different branches of one business is
  refused by the application under a lock; the database backstop covers
  whole-business ownership only.
- Per-booking prices are visible with RESERVATIONS/CUSTOMERS (they are
  what staff quote); aggregate spend and revenue need FINANCE.
- Privacy: a `[DECISION]` for counsel on processor terms when a business
  grants an organization customer access (`PRIVACY_POLICY_DRAFT.md`).
- Inherited: the sitemap regenerates hourly; `npm audit` reports 5
  moderate advisories in Sentry's build-time tooling (unreachable from
  requests); an intermittent booking-contention test timeout under load.

## Release verdict

**PARTIAL.** Every mandatory requirement of this prompt is implemented
and verified locally, with one deliberate partial (the directory loading
skeleton). It is not deployed: the two migrations must run on production
first, then the PR, then a signed-in production check (register → approve
→ invite as OWNED → accept with a grant → operate → withdraw). Phase 22 is
complete when that check passes; external gate integration stays a
separate, externally blocked milestone.
