# Permission matrix

Who can do what across organizations, venues, businesses and integrations. Every rule is
enforced on the server per request (roles and grants are re-read each time); a caller without
the right gets 404, the same answer as for something that does not exist.

## Organization roles (console)

| Action | Platform admin | Org OWNER | Org MANAGER (ADMIN) | Anyone else |
|---|:-:|:-:|:-:|:-:|
| View the console, integration health | ✓ | ✓ | ✓ | 404 |
| Edit profile, brand colour | ✓ | ✓ | ✓ | 404 |
| Invite / manage business associations | ✓ | ✓ | ✓ | 404 |
| Organize the directory, create venues (request) | ✓ | ✓ | ✓ | 404 |
| Metrics, portfolio, audit trail | ✓ | ✓ | ✓ | 404 |
| Publish the organization | ✓ | ✓ | – | 404 |
| Members (grant/remove roles) | ✓ | ✓ | – | 404 |
| **API keys and webhooks** (`org.integrations`) | ✓ | ✓ | – | 404 |
| Approve / reject / suspend the organization | ✓ | – | – | 404 |
| **Set or end the contract** | ✓ (`venues.manage`) | – | – | 404 |
| **Venue provider and venue credential** | ✓ (`venues.manage`) | – | – | 404 |

## What an organization reaches in a business

| Relationship | Business listed | Bookings (console delegation, API, webhooks) | Counts (REPORTS) | Money (FINANCE) | Plan visibility | Operate the business |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| HOSTED | ✓ (directory) | never | never (no scopes allowed — DB CHECK) | never | never | never |
| MANAGED | ✓ | with RESERVATIONS | with REPORTS | with FINANCE | – | within granted scopes |
| OWNED | ✓ | with RESERVATIONS | with REPORTS | with FINANCE | with FINANCE | within granted scopes |

- A grant can be limited to one branch; everything above then sees that branch only.
- Suspended, expired or removed associations grant nothing.
- No relationship ever exposes a customer's name, phone or email outside the business.

## API key scopes

| Scope | Endpoint | Further rule |
|---|---|---|
| `organization:read` | `GET /api/v1/organization` | — |
| `businesses:read` | `GET /api/v1/businesses` | approved associations only, public business fields |
| `venues:read` | `GET /api/v1/venues` | the organization's own venues |
| `bookings:read` | `GET /api/v1/bookings` | OWNED/MANAGED + RESERVATIONS, branch-limited; no customer data |
| `reports:read` | `GET /api/v1/reports/portfolio` | REPORTS for counts, FINANCE for money |

A key works only while: it is ACTIVE and not past its expiry (rotation grace), its
organization is APPROVED, and the organization's contract is in force.

## Venue roles

| Role | Scope | Can |
|---|---|---|
| VENUE_MANAGER | one venue | venue profile, zones, gates, hours, policy, switch visitor passes on/off |
| VENUE_SECURITY | one venue | the security desk (pass checks); no business data |
| COMPOUND_ADMIN | one compound | its venues |
| Platform `venues.manage` | all | choose a venue's provider, set/revoke its credential |
