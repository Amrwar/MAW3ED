# Organization test results

Phase 24. Run on 2026-11-03 (Cairo) on a production build
(`next build` + `next start`) against the QA database, with
`ACCESS_SANDBOX=1`. Every organization, business and person was created
through the product's own APIs. The few steps done directly in the
database are listed under "What was simulated". All names are fictional
test data, and everything was removed after each run.

| Script | What | Result |
|---|---|---|
| `scripts/qa-phase24.mjs` | Parts 1, 2, 3, 4, 6 over HTTP | **144/144** |
| `scripts/qa-phase24-browser.mjs` | Part 3 in Chromium, offline, a sweep of the Phase 24 screens, failure and retry termination | **21/21** |
| `scripts/qa-phase24-load.mjs` | Part 5, at the pilot's target traffic | **13/13** |
| `src/lib/organizations/phase24.db.test.ts` | The portfolio report on a real Postgres | **4/4** |
| `src/lib/organizations/delegation.test.ts` | The new RESOURCES scope (unit) | **13/13** (1 new) |

## What was simulated, and why

| Step | How | Why |
|---|---|---|
| Email confirmation of new accounts | `emailVerified` set in the database | There is no inbox on QA |
| A customer's phone proof | `User.phone` set in the database | No SMS provider on QA |
| A paid plan (staff, branches, unlimited bookings) | `plan`, `subscriptionStatus` set in the database | Subscribing goes through Paymob; not under test here |
| Time passing (a meal eaten, a visit 4 h ago, a booking yesterday) | The booking's date, times and instants moved together (`shiftBooking`) | The tests run at any hour |
| The gate | The access sandbox's gate and its signed callbacks | No real gate exists (Part 7) |
| Customer messages | In-app notifications of a signed-in customer are checked | WhatsApp, SMS and email are not configured on QA, so they are recorded as skipped. They are verified with each provider, not here |
| Load history | 20,000 past bookings inserted in SQL | Building a month of history through the API would take hours |

## Part 1 — organization journeys

### A. Restaurant group (owned): **PASS** — 25/25

* "Palm Dining Group (test data)" owns three brands. Each brand has its
  own account and chose its own grant:
  * Palm Grill: reservations, staff, tables, reports, finance.
  * Palm Cafe: reservations, reports.
  * Palm Sushi: reservations.
* **Ownership.** No brand's ownership moved to the group.
* **Centralized management.** The group's operations manager sees all
  three brands with exactly their grants.
* **Individual operations.** Each brand owner sees only their own
  bookings.
* **Booking separation.** Operating Palm Grill shows only Palm Grill's
  bookings. Switching to Palm Cafe shows only Palm Cafe's.
* **Staff management.** Allowed at Palm Grill (STAFF); refused at Palm
  Cafe.
* **Resource management.** At Palm Grill (RESOURCES) the manager reads
  the tables, resizes one and adds one; the tables page opens. At Palm
  Cafe the tables are closed (403). *Before Phase 24 no grant could open
  tables at all; fixed in this phase.*
* **Aggregated reporting** (new portfolio):
  * Palm Grill: counts and revenue.
  * Palm Cafe: counts, no revenue.
  * Palm Sushi: listed as "not shared".
  * Totals cover the two brands that share; no customer appears.
  * Brand owners get 404 on the portfolio; anonymous callers get 401.
* **Permissions.** The manager cannot:
  * read Palm Cafe's customers;
  * change its booking policy;
  * change its own grant.

### B. Shopping mall (hosted): **PASS** — 25/25

* **Tenant invitations.** Four businesses are invited as HOSTED. A mall
  cannot ask a tenant for any operating scope (422), and holds no OWNED
  relationship.
* **Membership approval:**
  * three accept and one declines;
  * a fifth asks to join and the mall approves it;
  * venue places are requested by the tenants and approved by the mall
    (floor, unit);
  * a tenant cannot approve its own request (404, three times).
* **Business directory, search and categories:**
  * the page lists the four tenants with booking links carrying
    `?org=`, and not the one that declined;
  * section headings come from the mall;
  * search narrows the list.
* **Public URL and QR.** The English page renders, and the QR encodes
  exactly `/groups/<slug>?src=qr`.
* **Booking through listed businesses.** See Part 3.
* **Privacy-safe venue reporting.** Mall and venue metrics are counts
  only. The mall's portfolio holds no tenants.
* **No unauthorized tenant access.** The mall cannot operate a tenant,
  nor read its bookings, customers or payments. Its tenant list has no
  customer or financial field.

### C. Clinic group: **PASS** — 12/12

* **Branch permissions.**
  * A branch relationship can carry reservations only (422 otherwise).
  * The coordinator operating branch A sees branch A's bookings, not
    branch B's, even by id.
  * Staff and hours stay closed to a branch relationship.
* **Provider scheduling.** At the dental clinic (STAFF + SCHEDULES) the
  coordinator adds a dentist and sets their weekly hours. They cannot
  give the dentist sign-in access, which stays owner only.
* **Booking policies.** Policies stay the owner's: the coordinator
  cannot change them. A 3-hour notice set by the owner is enforced: no
  time within 3 hours is offered, and one is refused if sent.
* **Restricted customer information.** There are no customer records
  without CUSTOMERS. The group's report has counts only.
* **Sensitive data.** The clinic is discreet by default. At the security
  desk, the dental patient's row says "مش ظاهر (خصوصية)" ("not shown,
  private") and never names the clinic (Part 6.3).

### D. Delegated management company: **PASS** — 12/12

* **Scoped permissions.**
  * "Cairo Ops Co." manages two independent businesses, each with its
    own grant.
  * It adds a service at the salon (SERVICES), but not at the dental
    clinic (reservations only).
  * Finance can never be delegated to a management company (422).
* **No cross-business escalation.**
  * Operating a business with no relationship is refused, as is a brand
    of another group.
  * A forged acting cookie grants nothing.
  * The company cannot widen its own grant.
* **Immediate revocation.** The owner withdraws every scope, and the
  company's very next request is refused. The salon leaves its
  portfolio.
* **Audit.** The relationship, the grants, the revocation and the acting
  sessions (`org.operate.start`) are recorded.

## Part 2 — the venue configuration (fictional "Nile Gate Mall")

**PASS**, within B above:

* parent venue organization, mall identity (ar/en), categories (the
  mall's sections) and independent tenants;
* visitor access, optional and sandbox: the platform picks the provider,
  the operator switches passes on, and the operator cannot repoint the
  provider;
* venue rules: booking required, 2 guests, north gate only;
* directory and QR, a security-desk role, and the organization console.

No real Eterna information was used (`PILOT_PLAN.md`).

## Part 3 — the customer journey

**PASS**: HTTP 27/27, browser 8/8.

| # | Step | Result |
|---|---|---|
| 1 | Opens the mall directory (QR link) | PASS. The visit is counted by channel |
| 2 | Browses businesses | PASS. The public API carries names and links only |
| 3 | Selects a restaurant, clinic or barbershop | PASS, all three |
| 4 | Selects a service or reservation | PASS. In the browser, the widget offers a table for the party size |
| 5 | Completes the booking | PASS. Credited to the mall, still owned by the restaurant. A clinic booking waits for the clinic to confirm |
| 6 | Receives confirmation | PASS. The booking page says confirmed, and the signed-in customer receives an in-app confirmation |
| 7 | Opens the booking QR | PASS. Not shown before the booking is confirmed |
| 8 | Requests visitor access | PASS. Pending until the provider confirms |
| 9 | Receives the real sandbox provider state | PASS. Active, with its own pass. The north gate admits; the car-park gate does not |
| 10 | Checks in | PASS. More than 30 minutes early the code says so and does nothing; on time, ARRIVED |
| 11 | Completes the booking | PASS. Refused before the start; done afterwards |
| 12 | Permitted follow-up | PASS. Exactly one review request, even with the job run twice, and no other message. The review is accepted. The pass no longer opens the gate |

The browser runs, in Chromium:

* **Arabic on a 390 px phone.** From the mall's QR link, the customer
  books a table with a party size through the widget. The booking page
  shows the QR and the sandbox pass with the venue's instructions. The
  page is right-to-left with no sideways scrolling.
* **English on a desktop.** The customer searches the directory and
  books a haircut.

## Part 4 — exceptions

**PASS** — 29/29 HTTP, plus the browser's offline checks.

| Exception | Result |
|---|---|
| Booking cancelled after the pass request | Pass revoked; the gate refuses it; the check-in code is dead |
| Booking rescheduled | The same code follows the new time (too early now); the pass no longer opens the gate at the old time |
| Duplicate confirmation | The second is harmless; the customer is told once. A double-submitted booking is one booking |
| Multiple guests | Two named guests, each with their own pass and link; the third is over the mall's limit (409) |
| Provider unavailable | The request stays pending (no fake pass, no error); the cron survives; the desk sees the trouble; the pass is issued after recovery |
| Customer without internet | **PARTIAL**. The QR stays on screen when the connection drops, with no spinner and at most 6 requests in 20 s. Reloading offline shows the offline notice, and the QR is gone (finding F1 in `LAUNCH_READINESS.md`); back online it loads |
| Invalid QR | Unknown, whether a made-up code or another site's URL |
| Expired QR | "Expired"; cannot check in |
| Unauthorized check-in | Another tenant learns nothing; the mall cannot check in; signed out is refused; the booking is unchanged |
| No-show | Marked; the code then says no-show |
| Invalid venue relationship | A tenant whose venue place is still a request offers no pass, and a request is refused |
| Business removed from the mall | Its visitors' passes stop at the gate; it leaves the directory; its bookings stand |
| Ownership changes | A second group cannot become owner while the first holds it. After the business leaves the first group and joins the second, the first group's manager loses access at once |
| Management permissions revoked | D4 above |
| Staff account disabled | The staff member's app token works, then the owner removes access and the same token is refused |
| Late customer arrival | Check-in works after the end within the late window; a day late it says expired |
| Duplicate provider callbacks | Accepted once; the two repeats are duplicates; one entry is recorded |

## Part 5 — load and performance

**PASS** — 13/13. These are local numbers: one `next start` process and
Docker Postgres on one PC (24 cores, 34 GB). They are a baseline and a
regression yardstick. They are **not** a claim about production capacity,
where Vercel scales functions out and Neon is a different database.

The world: one mall with 40 tenants (built through the APIs in 49 s), a
group managing all 40, and 20,000 past bookings. Each scenario ran for
20 s unless noted.

| Scenario | Load | Throughput | p50 | p95 | p99 | Errors | Pass criterion |
|---|---|---|---|---|---|---|---|
| Directory page (server-rendered) | 20 concurrent | 62/s | 321 ms | 369 ms | 397 ms | 0 | p95 < 1,000 ms |
| Directory public API | 20 concurrent | 179/s | 111 ms | 128 ms | 145 ms | 0 | p95 < 500 ms |
| Directory search and pages | 10 concurrent | 64/s | 154 ms | 189 ms | 204 ms | 0 | p95 < 1,000 ms |
| Availability across 40 tenants | 20 concurrent | 192/s | 104 ms | 121 ms | 138 ms | 0 | p95 < 800 ms |
| 30 customers racing for one time, ×10 | 300 requests | — | 282 ms | 352 ms | 362 ms | 0 | exactly one booking each time: **0 double bookings** |
| QR verification: 20 desks, 1 scan/s each | 20/s paced | 20/s | 111 ms | 140 ms | 146 ms | 0 (all 200) | p95 < 300 ms; none limited |
| 60 visitor-pass requests through the provider queue | 1 cron run | 60 issued in 1.4 s | — | — | — | 0 | all active within 3 runs |
| Signed provider callbacks, each delivered 3× | 20 concurrent, 10 s | 289/s | 65 ms | 104 ms | 163 ms | 0 | p95 < 300 ms; each entry recorded once |
| Group portfolio (40 businesses, 20k bookings) | 5 concurrent | 130/s | 38 ms | 42 ms | 53 ms | 0 | p95 < 1,000 ms; counts every booking |
| Mall page metrics | 5 concurrent | 196/s | 25 ms | 29 ms | 35 ms | 0 | p95 < 1,000 ms |
| Venue metrics | 5 concurrent | 118/s | 42 ms | 45 ms | 58 ms | 0 | p95 < 1,000 ms |

Repeated API failures (browser script, part 4):

* **Organization console.** A failing portfolio is asked for once, and
  the rest of the console works. When every console call fails, it says
  "Could not load" and offers one "Try again", with no loop.
* **Booking page.** A failing access API is asked at most 6 times in
  30 s, then stops, and no spinner is left turning.

The earlier loop audits (`qa-phase23-loops`, `qa-loops-browser`) still
pass; see "Regression" below.

Observed under load, by design: a business past the free plan's monthly
allowance has new online bookings held for confirmation (finding F2).
The load tenants are on a paid plan.

## Part 6 — end-to-end security

**PASS** — 14/14, together with the permission checks in parts 1 and 4.

| Requirement | Evidence |
|---|---|
| Organization permissions | A manager cannot appoint members or publish; an outsider cannot open another organization's console API |
| Business data isolation | A brand owner cannot open another brand's booking; booking separation in A |
| Clinic data privacy | The security desk lists the dental patient without the clinic. No phone, price or service is shown, and there are no customer fields in any organization report |
| No forged organization membership | A brand owner cannot add themselves to the group; a mall operator cannot grant venue roles (platform only) |
| No unauthorized visitor credential | A cancelled booking, an unknown link or a tenant not yet admitted cannot get a pass; the sandbox issuer needs the server secret |
| No cross-venue provider access | A pass is refused at another venue's site; one venue's security desk cannot open another venue's desk, nor change its own provider |
| Correct revocation | The revoked company, the departed group and the removed tenant hold nothing |
| Audit | Association, grant, acting session, check-in and venue access actions are all in the audit log |

## Part 9 — final tests

See `docs/qa/PHASE_24_REGRESSION_RESULTS.md`:

* tsc and lint clean;
* 1,311 unit, integration and DB tests;
* mobile: 206 tests;
* the earlier QA scripts;
* what did not run, and why.

The post-phase audit (`docs/qa/PHASE_24_POST_AUDIT.md`) added three HTTP
checks, one browser check and six DB checks. It reran the scripts above:
HTTP 147/147, browser 22/22, load 13/13 in the second of two audit runs.
