# Organization permissions

Who may do what, and how it is decided. Every rule is evaluated on the
server on every request from the database; nothing the browser sends
(a business id, a role, a cookie) is believed by itself.

## The five roles

| Role | Who | Defined by |
|---|---|---|
| Parent organization owner | Registered the organization, or appointed by the platform | `VenueRole` `ORGANIZATION_OWNER` |
| Organization manager | Appointed by the owner | `VenueRole` `ORGANIZATION_ADMIN` |
| Venue manager | Runs one venue | `VenueRole` `VENUE_MANAGER` (Phase 22) |
| Business owner | Owns the business account | `Business.ownerId` |
| Delegated manager | An organization owner or manager operating a business through a granted relationship | an APPROVED, unexpired `OrganizationBusiness` (OWNED or MANAGED) with scopes, of an APPROVED organization the person belongs to |

Legal or commercial ownership alone grants nothing technical: the
"delegated manager" role exists only while all four conditions hold, and
ends on the very next request when any stops holding (scope withdrawn,
relationship paused or removed, organization suspended, person removed
from it, expiry reached).

## Scopes and what they open

| Scope | Opens | Never opens |
|---|---|---|
| RESERVATIONS | Bookings (read all, confirm, progress, cancel, reschedule, key one in), the calendar; services and staff names to book with | Customer book, money |
| CUSTOMERS | The customer book and a customer's history; notes | — |
| SERVICES | Services (create, edit, remove) | — |
| STAFF | Staff records, each person's hours and time off | **Who may sign in** (`staff.manageAccess` — owner only, always) |
| SCHEDULES | Business opening hours and business-wide closures | — |
| PROFILE | Public profile: names, contact, about, images, category, city | Slug, publishing, plan |
| REPORTS | Booking, performance and customer-count reports — counts only | Revenue columns |
| FINANCE (OWNED only) | Revenue report, revenue per staff, customer spend | Recording payments, billing, subscription |

What no delegate ever gets, whatever is granted: billing and
subscription, publishing or unpublishing, booking-policy and payment
settings (deposit, auto-confirm, notifications), staff sign-in access,
offers, referrals, import, branches, venue memberships, organization
memberships, and changing any delegation (granting is the owner's alone —
a delegate operating a business cannot reach the routes that grant).

A delegation limited to one branch carries RESERVATIONS only, and sees
that branch's bookings only (`bookingScope`); a booking keyed in by hand
carries no branch, so branch-limited delegates cannot key one in.

## Matrix

| Action | Platform | Org owner | Org manager | Venue manager | Business owner | Delegated manager | Customer |
|---|---|---|---|---|---|---|---|
| Register an organization | ✔ | any confirmed account | | | ✔ | | ✔ |
| Approve / reject / suspend an organization | ✔ | | | | | | |
| Publish the organization page | ✔ | ✔ | | | | | |
| Edit organization profile, media | ✔ | ✔ | ✔ | | | | |
| Appoint / remove managers | ✔ | ✔ | | | | | |
| Put the organization under a parent | ✔ | ✔ (owning both) | | | | | |
| Invite a business (any type), ask for scopes | ✔ | ✔ | ✔ | | | | |
| Approve / reject a business's request | ✔ | ✔ | ✔ | | | | |
| Pause / resume / remove a relationship | ✔ | ✔ (resume only its own pause) | ✔ | | ✔ own (resume only its own pause) | | |
| Accept / decline; request; leave | | | | | ✔ own | | |
| **Grant, change, withdraw scopes and expiry** | | | | | **✔ own only** | | |
| Operate a business (dashboard, APIs) | | within grant | within grant | | ✔ everything | within grant | |
| Read a hosted tenant's bookings, customers, money | | ✘ | ✘ | ✘ | ✔ own | — | own bookings |
| Organization metrics (visits, attributed counts) | ✔ | ✔ | ✔ | | | | |
| Venue details, floors, gates, tenants (Phase 22) | ✔ | ✔ | ✔ | own venue | | | |

## How it is enforced

- `src/lib/business-access.ts` — the business actor. `OWNER`, staff
  `MANAGER`/`PROVIDER` (unchanged), and `DELEGATE`, whose `can()` is
  exactly the actions its granted scopes add up to.
- `src/lib/organizations/delegation.ts` — `resolveDelegation(user,
  business)`: the four conditions, re-read per request.
- **Acting context.** A delegate chooses a business to operate
  (`POST /api/organizations/acting`, refused unless a live grant exists;
  audited). An httpOnly cookie names the business — it grants nothing by
  itself; every request decides again.
- **Default deny.** The 40 owner-only API routes still call
  `requireBusiness()`, which refuses delegates and, while someone is
  acting for another business, refuses (409 `acting-elsewhere`) even on
  their own business — so a click meant for the business on screen never
  lands on a different one. Only the routes a scope covers were moved to
  `requireBusinessAccess(action)`.
- **Pages.** The proxy turns every owner-only dashboard page away while
  acting (`acting-paths.ts`, database-free); each delegate-capable page
  checks the scope again (`requireDashboardAccess`). The owner's private
  settings are not even sent to a delegate's browser; money columns are
  stripped on the server without FINANCE.
- **The database** refuses scopes on hosted relationships, finance to
  non-owners, and non-reservation scopes on branch relationships
  (`ORGANIZATION_RELATIONSHIPS.md`).

## Privacy note

Granting RESERVATIONS or CUSTOMERS lets the organization's people see the
customer names and contact details those functions need. That is the
business owner's decision, made explicitly, revocable at any moment, and
logged. Legally the business remains the controller of its customers'
data and the organization processes it on the business's behalf; the
privacy draft carries a `[DECISION]` for counsel on the processor terms.
A hosting mall never sees any of it.
