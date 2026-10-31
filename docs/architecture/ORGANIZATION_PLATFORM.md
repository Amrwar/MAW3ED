# Organization platform

Maw3ed supports **parent organizations** — malls, compounds, commercial
buildings, restaurant and clinic groups, barbershop chains, franchises,
companies owning several businesses — that present and coordinate many
businesses under one account. It is generic: Eterna (a mall inside an
Emaar compound) is one organization among any number, entered as data.
Nothing in the code names an operator.

Related: `VENUE_BUSINESS_RELATIONSHIPS.md` (how a business belongs),
`QR_AND_ACCESS_TYPES.md` (the different QR codes), `VENUES.md` (venues),
`docs/roadmap/UPDATED_PHASES_22_24.md`, `docs/testing/ORGANIZATION_ACCEPTANCE_MATRIX.md`.

## Inventory before this work (2026-10-31)

| Capability | State after Phase 22 | Gap |
|---|---|---|
| Operator record | `VenueOrganization`: slug, names, website. Created only by platform admins | No type, profile, contact, media, status, publishing, public page, QR, dashboard |
| Locations | `Compound`, `Venue` (optional, with floors, gates, hours, policy) | — (reused as the organization's locations) |
| Business ↔ venue | `VenueMembership` (business or branch, request → approve/reject/remove) | No **invitation** direction; no organization-level relationship for groups without a venue |
| Roles | `VenueRole` scoped to organization / compound / venue | No organization **owner** distinct from manager; no member management |
| Public pages | `/venues/[slug]` per venue | No organization page spanning locations and venue-less brands |
| QR | Business QR (`/api/business/qr`, attributed `?src=qr`) | No organization QR |
| Visits & attribution | `ProfileView` per business, `Booking.source` channel | No organization visit counter; no record that a booking started on an organization page |
| Dashboard | Venue console `/venue-admin` | No organization dashboard |
| Self-registration | — | Organizations can only be created by platform admins |
| Multi-business ownership | `Business.ownerId` is unique: one account owns one business | Kept (see below) |

Conflicts found and how they are resolved:

- **One business per account.** A group's brands each keep their own
  owner account and dashboard. The organization relates to them through
  an approved association and never owns them in the data model. "Create
  a new business" therefore means *inviting a person to create it under
  the organization*: the business is created through the normal
  onboarding (so it gets its own owner, staff, services, calendar,
  customers, money and subscription) and is linked on creation. A
  multi-business switcher for one account is a separate, later change.
- **`VenueOrganization` naming.** Kept as the table; the model is renamed
  `Organization` in code. No data moves.

## Model

Relationship types and their rules: `ORGANIZATION_RELATIONSHIPS.md`.
Who may do what, and how it is enforced: `ORGANIZATION_PERMISSIONS.md`.

```
Organization (type: MALL | COMPOUND | BUSINESS_GROUP | RESTAURANT_GROUP | CLINIC_GROUP | FRANCHISE | COMMERCIAL_BUILDING | OTHER)
 ├─ parent: at most one parent organization (≤ 3 levels, never a cycle — DB trigger)
 ├─ profile: names, descriptions, logo, cover, contact, socials, website, HQ location
 ├─ status: PENDING_REVIEW → APPROVED (platform) | REJECTED | SUSPENDED; isPublished (owner, once APPROVED)
 ├─ members: VenueRole rows scoped to the organization — ORGANIZATION_OWNER, ORGANIZATION_ADMIN (manager)
 ├─ locations (optional): Compound, Venue (+ floors, gates, hours, visitor policy)
 ├─ OrganizationBusiness (one row per relationship: OWNED | HOSTED | MANAGED; one business may have several)
 │     invitation (organization → business, or → email to create one), asking for scopes
 │     request    (business → organization), granting scopes up front
 │     status INVITED | REQUESTED | APPROVED | SUSPENDED | DECLINED | REJECTED | REMOVED
 │     scopes granted by the business (OWNED/MANAGED only), optional expiresAt
 │     at most one OWNED per business (DB unique)
 │     optional venue placement on acceptance; directory section and order
 ├─ VenueMembership (placement of a business/branch in one of its venues — Phase 22)
 ├─ OrganizationView (visits by source and day — a counter)
 └─ OrganizationBookingAttribution (a booking that started on its page)
```

Bookings, customers, payments, staff, services and subscriptions stay on
the business. Attribution is a separate row that never changes who owns
the booking.

## Permission matrix

| Action | Platform admin | Org owner | Org manager | Venue manager | Business owner | Business staff | Customer |
|---|---|---|---|---|---|---|---|
| Register an organization | ✔ | — (any signed-in account with a confirmed email may register one and becomes its owner) | — | — | ✔ | ✔ | ✔ |
| Approve, reject, suspend an organization | ✔ | — | — | — | — | — | — |
| Publish / unpublish its page (once approved) | ✔ | ✔ | — | — | — | — | — |
| Edit profile, media, contact | ✔ | ✔ | ✔ | — | — | — | — |
| Add / remove managers | ✔ | ✔ | — | — | — | — | — |
| Invite a business; approve or reject a request | ✔ | ✔ | ✔ | — | — | — | — |
| Remove an association (business is not deleted) | ✔ | ✔ | ✔ | — | ✔ own | — | — |
| Accept / decline an invitation; request to join; leave | — | — | — | — | ✔ own | — | — |
| Organize the directory (sections, order, venue placement) | ✔ | ✔ | ✔ | own venue | — | — | — |
| Create a venue (draft) under the organization | ✔ | ✔ | ✔ | — | — | — | — |
| Publish a venue | ✔ | — | — | — | — | — | — |
| Venue details, hours, floors, gates, policy, tenants | ✔ | ✔ | ✔ | own venue | — | — | — |
| Organization link, QR, visits, attributed bookings | ✔ | ✔ | ✔ | — | — | — | — |
| Organization audit log | ✔ | ✔ | ✔ | — | — | — | — |
| Read a business's customers, bookings' contents, notes, staff | own business only | only within scopes the business granted (OWNED/MANAGED); never for HOSTED | same as owner | ✘ | ✔ own | per staff role | own bookings |
| Payments, billing, subscription, sign-in access, publishing | own business only | ✘ (no scope reaches them) | ✘ | ✘ | ✔ own | per staff role | — |
| Grant, change, withdraw an organization's scopes | ✘ | ✘ | ✘ | ✘ | ✔ own only | ✘ | — |
| Browse published organization pages; book | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

Every rule is enforced on the server (`src/lib/organizations/access.ts`,
`src/lib/venues/access.ts`); a refusal is a 404 so nothing private is
discoverable. Organization metrics are counts — visits by source and
bookings attributed to the organization page, and per-business counts of
attributed bookings — never customer details, services booked, prices or
payments. Mall management never sees patient details or tenant finances:
a hosted relationship cannot carry any scope (refused by the database).
An owning or managing organization sees exactly what the business owner
granted, and nothing once withdrawn — see `ORGANIZATION_PERMISSIONS.md`.

## Public experience

- `/groups/[slug]` — the organization's landing page (any type): identity,
  description, locations with directions and venue hours, categories,
  every approved business whose own page is published (search, category
  and location filters, pagination for large directories), book-now
  links carrying the organization, contact and socials, share.
- `/venues/[slug]` — a single location's page (Phase 22), now linking to
  its organization.
- `/groups` — published organizations.
- Arabic RTL and English LTR (`/en/...`), canonical URLs and hreflang via
  the existing SEO helpers, `noindex` until an organization lists a
  business.

## Booking through an organization page

The organization page links to each business's own page with
`?org=<slug>` (and `?branch=` when the business is listed by branch). The
booking widget sends the organization with the booking; after the
booking is created by the **existing engine**, an attribution row is
written if the organization is published and the business is approved
in it. Attribution failing never fails a booking, and no second booking
or customer record is created.

## Optional visitor access

Off by default and irrelevant to most organizations. See
`QR_AND_ACCESS_TYPES.md`; delivered in Phase 23 per the updated roadmap.
