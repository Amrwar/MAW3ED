# Phase 22b report: the organization platform

Generic parent organizations — malls, compounds, business groups,
franchises, commercial buildings — as a first-class, self-serve part of
MAW3ED, replacing the operator-only `VenueOrganization` admin object.
Built under the owner's architectural correction of 2026-10-31: no gate
integration, no hardcoded partner, booking through organization pages
uses the existing engine with attribution only.

## How this phase was run

Inspection first (the Phase 22 venue platform, `Business.ownerId`
uniqueness, the onboarding transaction, the attribution/day modules),
then architecture documents, then schema + migration, library, APIs,
public pages, consoles, admin review, and the test pyramid. All
verification is local (QA Postgres in Docker + a production build on
:3101); production claims are made nowhere in this report.

## Existing functionality discovered (verified, kept)

- `VenueOrganization` (Phase 22) was an admin-created operator object.
  Reused as the `Organization` model via `@@map` — no data move, no
  duplicate architecture. Existing operator rows backfilled `APPROVED`
  once (column-comment marker makes the backfill one-time).
- `Business.ownerId` is unique (one business per account). Kept:
  organizations never own businesses; "create a business under an
  organization" is an email invite into the normal onboarding, which
  creates the business under the invitee's account and the association
  in the same transaction.
- The booking engine, slots, notifications, payments: untouched. The
  only booking-path change is an optional `org` field on the public
  booking body that writes an attribution row after creation and can
  never fail the booking.
- The venue platform (floors, gates, policies, tenancies) is unchanged
  and its suites re-run green; venues now cross-link to their published
  organization.

## Changes implemented

- **Model** (`prisma/schema.prisma`): `Organization` (kind MALL /
  COMPOUND / BUSINESS_GROUP / FRANCHISE / COMMERCIAL_BUILDING / OTHER,
  status PENDING→APPROVED/REJECTED/SUSPENDED, `isPublished`, profile,
  city, creator), `OrganizationBusiness` (INVITED / REQUESTED →
  APPROVED / DECLINED / REJECTED → REMOVED; optional branch; partial
  unique index over live rows), `OrganizationInvite` (unguessable
  token, 14 days, cancel/claim), `OrganizationView` (one integer per
  org/channel/day), `OrganizationBookingAttribution` (bookingId
  unique). New `VenueRoleKind.ORGANIZATION_OWNER`.
- **Library** (`src/lib/organizations/`): pure authority matrix
  (`access.ts`: PLATFORM / OWNER / MANAGER over ten `org.*` actions —
  managers cannot publish, appoint or review; owners cannot review),
  request-scoped guard (401/404, `requireOrgAccess`), input rules
  (reserved slugs, http(s)-only website), the association state machine
  (`associations.ts`: invite by slug, request to join, decide,
  respond-as-business, email invites claimed inside onboarding's
  transaction; conditional `updateMany` against races; recruiting and
  joining refused until the platform approves the organization), the
  public loader + paging + SEO (`public.ts`, `seo.ts`), counts-only
  metrics, `attributeBooking` (published org + approved association or
  nothing; swallows its own errors).
- **APIs**: `/api/organizations*` (register with confirmed email +
  rate limit; console payload; profile/publish PATCH; businesses;
  members; email invites; marketing QR; metrics; audit),
  `/api/business/organizations*` (owner view, request, accept /
  decline / leave), `/api/public/groups*` (+ per-slug view counter),
  `/api/public/org-invites/[token]`, `/api/admin/organizations/[id]`
  (review with written reason for rejection/suspension).
- **Pages**: public `/groups` + `/groups/[slug]` (ar/en, hero, contact,
  venues, searchable/paginated directory, `?org=` booking links,
  JSON-LD, hreflang, noindex-when-empty), `/org-admin` +
  `/org-admin/[id]` (console: status banner, publish, link + QR
  downloads labelled "marketing, not an entry pass", metrics tiles,
  associations with section/order, email invites, members, audit),
  `/dashboard/organizations` (the business owner's side), admin review
  section on `/admin/venues`; onboarding accepts `?org_invite=` with a
  banner and transactional claim; sitemap lists organizations with
  listings.
- **Migration**: `prisma/migrations/phase22b_organizations.sql`,
  idempotent, applied to QA three times cleanly.

## Database changes

New enums `OrganizationKind`, `OrganizationBusinessStatus`,
`OrganizationBusinessRelation`; new columns on `VenueOrganization`;
four new tables (above); `VenueRole_scope_chk` recreated to admit
`ORGANIZATION_OWNER`. One-time backfill marks pre-existing operator
rows APPROVED. Apply **before** the deploy; the running code tolerates
the new columns being present ahead of it.

## Tests executed (all local, 2026-10-31)

| Suite | Result |
|---|---|
| `npx tsc --noEmit` | PASS, 0 errors |
| `npx eslint .` | PASS, 0 errors, 6 warnings (same six as `main`) |
| `npx next build` | PASS, all new routes compiled |
| Vitest (unit + DB) | **1172 passed**, 34 skipped (112 files) — includes `organizations.test.ts` 8/8 and `phase22b.db.test.ts` 12/12 |
| `scripts/qa-phase22b.mjs` (E2E) | **69/69** — registration/review gates, members (duplicate appointment 409), admin ORGANIZATION_OWNER grant path, associations, directory ar/en + SEO, QR byte-equality to `/groups/<slug>?src=qr`, business-QR regression, views, attribution (+ forged slug credits nobody), counts-only metrics, email-invite lifecycle, removal, suspension |
| `scripts/qa-booking-e2e.mjs` | **22/22** — now includes a real-browser widget booking from `?org=` with the attribution row checked |
| Regression: qa-phase17 / 19 / 20 / 21 / 22 | 13/13, 21/21, 19/19, 44/44, 68/68 |
| `scripts/qa-security.mjs` | 32/32 |
| `scripts/qa-venue-console.mjs`, `qa-venue-page.mjs` | clean |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Browser sweep (`qa-phase18.mjs`, now incl. `/groups`, `/groups/qa18-group`, `/org-admin`, `/org-admin/[id]`, `/dashboard/organizations`) | PASS — 440 page loads (ar/en × 375/768/1024/1440), 0 flagged, 0 serious/critical axe, no overflow, no console errors |

Per-requirement mapping: `docs/testing/ORGANIZATION_ACCEPTANCE_MATRIX.md`.

Two QA-script defects were found and fixed along the way (not product
bugs): the Phase 20 view-cap check counted on the UTC day while views
land on the Cairo day (failed only between midnight Cairo and midnight
UTC), and a Phase 22 check still expected the sidebar link at
`/venue-admin` after the console moved to `/org-admin`.

### Tests NOT RUN / BLOCKED

- Production verification: nothing of this phase is deployed yet.
- Rows Y/Z/AA of the acceptance matrix (optional access module,
  provider outage, credential revocation) belong to Phase 23 by the
  revised roadmap and were not run.

## Security and privacy posture

- Registration needs a confirmed email and is rate-limited; a new
  organization is PENDING and private — it cannot publish, recruit or
  be joined until a platform administrator approves it, so typing a
  mall's name grants no standing.
- Associations are explicit and two-sided; neither side can act for
  the other; removal unlists and deletes nothing; ownership never
  moves. All decisions are audited.
- Organization staff see counts only — views by channel, attributed
  bookings, bookings per business name. The E2E asserts the metrics
  payload contains no name/phone/price material.
- The marketing QR is a plain link (`?src=qr`) generated with the same
  options as the expected code (byte-equal in the E2E) and is labelled
  in the console as not an entry pass. No credential of any kind is
  issued in this phase.
- The invite token is 24 random bytes, single-use, expiring, cancellable;
  the public invite endpoint returns the organization's name and the
  expiry — nothing else.

## Known limitations

- Organization venues are still created by the platform admin (the
  Phase 22 flow); `org.venues.create` is reserved in the matrix but no
  self-serve venue creation ships in this phase.
- The directory loads an organization's approved associations in one
  query and pages in memory; proven to 150 tenants under 5s in the DB
  test. Thousands of tenants would want a paged query.
- `/groups` index lists every published organization (no city filter
  yet).
- Email invites return the link always; actual delivery depends on
  Resend being configured (prod has it; QA proves the fallback).
- An organization's ownership cannot be transferred from its console;
  the platform does it through the admin role API
  (`docs/runbooks/ORGANIZATION_OPERATIONS.md`).
- The sitemap regenerates hourly, so a newly published organization
  reaches it within an hour, not instantly.

## Code review of this phase's changes

An independent review of the full diff (84 files vs `main`) reported
eight findings; all eight were fixed and are now covered by tests:

1. **Admin `ORGANIZATION_OWNER` grant 500** — the scope-existence check
   only knew ORGANIZATION_ADMIN/COMPOUND_ADMIN, so the newly allowed
   OWNER kind fell into the venue branch with an undefined id. Fixed to
   branch on the scope id present; E2E exercises the path.
2. **A suspended organization kept collecting businesses** through
   invitations sent while it was approved: `respondAsBusiness(accept)`,
   `readInvite` and the transactional `acceptEmailInvite` now all
   re-check the organization's standing (DB tests, incl. the rollback).
3. **Duplicate roles** — nothing enforced one role per person per
   scope, so the 409 catches in the members and admin routes were dead.
   The migration now dedupes and adds `VenueRole_scope_unique`
   (functional unique index over the COALESCEd scope columns).
4. **An omitted `section` wiped the stored one** — zod runs transforms
   on omitted keys, so the decision schema's optText turned "not sent"
   into null. A `decisionText` helper keeps absent keys absent (unit
   test pins the three cases).
5. **Overlap race** — whole-business vs branch association could both
   land under concurrency (the partial unique index cannot compare the
   two shapes). Check+insert now serialize under a per-(organization,
   business) transaction-scoped advisory lock; a concurrency DB test
   proves exactly one lands.
6. **Metrics windows disagreed** (views counted windowDays+1 days on a
   UTC cutoff against Cairo-day buckets; bookings exactly windowDays).
   The views cutoff is now `cairoDayBefore(windowDays − 1)`.
7. **Per-business metrics** loaded every attribution row then ran an
   unbounded `IN` query; replaced with one bounded SQL join returning
   names and counts only.
8. **`/company/[slug]` gained a serial query** — the organization
   lookup now runs in a `Promise.all` with the venue lookup.

The review also surfaced two sweep artifacts, fixed at their source:
per-row admin console links no longer prefetch (prefetching a whole
authed console per table row was waste, and on the plain-http QA server
the production CSP's `upgrade-insecure-requests` turned the prefetch's
locale redirect into a failing https request), and the sweep no longer
counts a 404 page's own expected load error as a console defect.

## Completion audit (2026-10-31, after release)

A release-blocking re-audit of the merged code (`a89df6f`), done by
reading the code against the requirements rather than trusting the
earlier report. It found **eleven defects the earlier review had not**.
All are fixed on branch `phase-22b-audit`, each with a regression test
that fails on the pre-fix code where that is mechanically checkable
(D4 and D6 were run against `main`'s files: both fail there and pass
after).

| # | Severity | Defect | Fix | Proof |
|---|---|---|---|---|
| D1 | High — requirement gap | The console could not set logo, cover, city or kind, though the public page shows them: "media" was undeliverable | Profile form gains kind and city selects and logo and cover uploads (shared `ImageUpload`, new `maw3ed/organizations` folder) | E2E: a real browser picks a city and saves, and the DB row changes; upload controls present; logo saved through the API |
| D9 | High — trust | An approved organization could rename itself or change its kind without re-review ("approved as a small group" → "a famous mall") | A name or kind change by the organization sends it back to PENDING and offline, audited as `org.identity.changed` with old and new values; the form warns before saving; platform edits are exempt | E2E: rename → PENDING, page 404, cannot republish, description-only edit is not re-reviewed, re-approval restores |
| D10 | Medium — security | The organization's name was interpolated unescaped into invite-email HTML (markup or links in mail from our domain) and the subject (newlines) | `orgInviteEmail()` escapes the body and forces the subject onto one line | Unit test with a hostile name |
| D2 | Medium — abuse | No rate limit on email invites (each sends mail) or member appointments (each reveals whether an address has an account) | Buckets `orgInvite` 30/h and `orgMember` 10/h per user | E2E: the 11th lookup is 429; bucket sanity test |
| D3 | Medium — SEO | The sitemap was built once at deploy and never refreshed: organizations (and businesses) published later were missing until the next deploy. The earlier E2E check was removed on the wrong premise that this was expected | `revalidate = 3600` | Unit test pins it. Seen locally: `x-nextjs-cache: HIT` with a published, listed organization absent |
| D8 | Medium — honesty | The admin screen promised the rejection or suspension reason would be "shown to the organization"; it never was | The console API returns the latest reason from the audit log; the console shows it | E2E: after suspension the organization reads the reason |
| D6 | Low | Logo and cover accepted any URL scheme (`javascript:`, `data:`, any host) and fed Open Graph tags | https on the CSP image hosts only | Unit (fails on `main`); E2E 422 |
| D7 | Low | The "attributed bookings" headline counted rows whose booking had been deleted (no FK); the breakdown joined, so the two disagreed | The headline joins `Booking` too; no migration needed | DB test: delete a business, the counts agree |
| D5 | Low | The public groups API leaked an internal `_count` field | Stripped | DB test on the shape |
| D4 | Low | `?page=2.5` produced a fractional page | Floored; NaN and Infinity land on page 1 | Unit (fails on `main`) |
| D11 | Low | An owner could appoint themselves as manager (a duplicate authority row, which also breaks a rollback step) | Refused 409 `already-owner` | E2E |

**Break-it probe** (`scratchpad/break-22b.mjs`, 16 attacks, all held):
malformed JSON, form-encoded body, a 100k-character name, three
concurrent registrations of one slug (exactly one 201, two 409s, one
row), unknown ids, garbage and 5000-character invite tokens, a forged
session cookie, hostile `?page=` values, a 500-character and an
injection-shaped `org` on a booking.

**Checked and found sound:** owner-only business routes (staff get
404); the link builders (`tel:`, `mailto:`, https-only website, social
handles on a fixed host); provider outage (`sendEmail` never throws, so
the invite still returns its link); FK deletion behaviour (cascades;
actor ids deliberately carry no FK, so deleting a user never blocks);
atomicity (registration, review, removal and invite claim are each one
statement or one transaction); the join list showing approved but
unpublished organizations to owners (intended: they recruit before
going public, and only name, kind and city are shown).

**Database safety.** The audit added no migration. A rollback
procedure now exists (`docs/runbooks/ORGANIZATION_OPERATIONS.md`). The
pre-22b Prisma client cannot read `ORGANIZATION_OWNER`, so owner roles
are re-expressed as manager roles before a code rollback and restored
after. The SQL was dry-run on QA (1 → 0 → 1 owner rows). The claim that
the old client would fail follows from how Prisma handles enums; it was
not executed against a pre-22b build.

**Dependency advisories.** `npm audit --omit=dev` now reports 5
moderate advisories (glob, minimatch), published after the phase ran.
They arrive only through `@sentry/bundler-plugins`, the build-time
source-map uploader; application code never calls glob. Both advisories
need attacker-controlled patterns or an AbortSignal, and no request can
reach either. The only fix offered is a major-version Sentry downgrade;
even the latest Sentry (11.10.0) pins the vulnerable range. This is a
residual risk, not a phase defect: re-check when Sentry ships a fix.

### Re-verification after the audit fixes (final build, 2026-10-31)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS, 0 errors |
| `npx eslint .` | PASS, 0 errors, 6 warnings (same six as `main`) |
| `npx next build` | PASS; the sitemap now shows a 1h revalidate |
| `BOOKING_DB_TEST_URL=… npx vitest run` | **1179 passed**, 34 skipped (org unit 15/15, org DB 14/14) |
| `node scripts/qa-phase22b.mjs` | **83/83**, including a real-browser profile save |
| break-it probe | **16/16 held** |
| qa-phase17 / 19 / 20 / 21 / 22 | 13/13, 21/21, 19/19, 44/44, 68/68 |
| `node scripts/qa-booking-e2e.mjs` | 22/22 |
| `qa-venue-console.mjs`, `qa-venue-page.mjs` | clean |
| `node scripts/qa-security.mjs http://localhost:3101` | 32/32 |
| `node scripts/qa-phase18.mjs` (axe, ar/en × 4 widths) | 440 page loads, 0 flagged, 0 serious or critical |
| `npm audit --omit=dev` | 5 moderate, build-time only, unreachable from requests (see above) |

## Release readiness

Code complete and locally verified. The review findings and the
completion-audit defects are fixed and re-verified. The audit fixes
need **no migration**: merging their PR is the only production step.

Deploy order: run `phase22b_organizations.sql` on production **before**
merging the PR (helper: `migrate-phase22b.sh` in the session scratchpad,
verify included), then merge.

## Completion verdict (the owner's seven items, rated separately)

1. **Organization registration and management** — **PASS (local)**:
   register → review → approve → profile/publish/members, proven by
   E2E 83/83 and DB 14/14 (after the completion audit).
2. **Venue and business association** — **PASS (local)**: invite /
   request / email-invite flows, approvals both sides, overlap and
   branch rules, removal without deletion; DB + E2E.
3. **Public directory experience** — **PASS (local)**: `/groups` and
   `/groups/[slug]` ar/en, search/sections/pagination, SEO with
   noindex-when-empty; axe/overflow sweep clean (440 loads, 0 flagged).
4. **Links and QR generation** — **PASS (local)**: org URL + QR decode
   to `/groups/<slug>?src=qr` (byte-equal), business QR regression
   green, "not an entry pass" stated in the console.
5. **Booking through organization pages** — **PASS (local)**: real
   browser books from a `?org=` page through the existing engine; the
   attribution row is written; a forged slug credits nobody; direct
   bookings unattributed.
6. **Optional visitor-pass module** — **NOT STARTED** (Phase 23 by the
   revised roadmap; parked groundwork exists on `phase-23-access`).
7. **External gate integration** — **BLOCKED (external)**: requires a
   written agreement and interface documentation from the operator.
   Nothing in this phase claims, simulates or issues gate access.

Phase 22b is complete when items 1–5 are also verified on production
after the migration + deploy; 6 and 7 are explicitly out of its scope.

**Release verdict after the completion audit: PARTIAL.** Every
mandatory requirement passes locally, and the migration is live and
verified on production. The audit's fixes (two of them high severity:
media editing and re-review on rename) are not deployed yet, and no
signed-in organization flow has been exercised on production, because
no organization exists there. Once the audit PR is merged and a
signed-in check is run on production (register → approve → publish →
invite → book), the verdict becomes PASS.
