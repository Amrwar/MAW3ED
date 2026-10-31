# Organization platform — acceptance matrix

## Phase 22 final — the owner's required tests 1–26

All runs on 2026-10-31, local QA (Docker Postgres with every migration
applied + a production build on :3101). Nothing here is a production
claim. Sources:

- **DB** — `src/lib/organizations/phase22c.db.test.ts` (12 tests) and `phase22b.db.test.ts` (14)
- **unit** — `src/lib/organizations/delegation.test.ts` (12), `organizations.test.ts` (13)
- **E2E** — `scripts/qa-phase22c.mjs` (56 checks, HTTP + real browser), `scripts/qa-phase22b.mjs` (83)
- **mig** — `scratchpad/migration-preservation.sh` (legacy rows + row counts around a re-run of both migrations)

Command: `BOOKING_DB_TEST_URL=postgresql://qa:qa@localhost:5450/maw3ed_qa npx vitest run src/lib/organizations` → 51 passed;
`AUTH_SECRET=<server's> node scripts/qa-phase22c.mjs` → 56/56; `node scripts/qa-phase22b.mjs` → 83/83.

| # | Requirement | Proof | Result |
|---|---|---|---|
| 1 | Create every supported organization type | DB "1": all 8 kinds (incl. RESTAURANT_GROUP, CLINIC_GROUP); E2E: register both new group kinds through the API | **PASS** |
| 2 | Parent company with owned businesses | DB "2/11": group owns two brands, operates one within its grant; owning on paper with no grant = no access; E2E 2 | **PASS** |
| 3 | Invite and approve hosted businesses | DB "3/8/9"; E2E 3/8 (hosted invite asking for access refused 422; plain hosted accepted) | **PASS** |
| 4 | Delegate and revoke management | DB "4/22": narrow, expiry, pause (and the org cannot undo the business's pause), org suspension, member removal, withdraw-all — each ends access at once; E2E 4: withdrawal ends access on the very next request | **PASS** |
| 5 | One business owned by a group and hosted by a mall | DB "5/13": OWNED + HOSTED + MANAGED on one business, no duplicate rows; E2E: qa-salon owned by the group and hosted by the mall | **PASS** |
| 6 | Membership removal preserves records | DB "6/12" (bookings, business intact after removal); 22b DB "H/I" | **PASS** |
| 7 | Unauthorized membership denied | DB "7/10" (stranger, other org's manager, legacy label, self-grant: all refused); 22b E2E (stranger 404, anonymous 401) | **PASS** |
| 8 | Hosted mall cannot access tenant bookings | DB "3/8/9" (code, API and DB CHECK all refuse); E2E 8/9 (mall owner cannot start operating: 404) | **PASS** |
| 9 | Hosted mall cannot access tenant finances | DB + E2E 9 (even the business cannot hand a hosted mall FINANCE: 422) | **PASS** |
| 10 | Organization manager cannot escalate | unit (no scope reaches `staff.manageAccess`); DB "7/10" (FINANCE refused to MANAGED by code and DB); E2E 10 (403 on services/customers/profile/sign-in access without scope; managers cannot reorganize ownership); R4 (STAFF delegates cannot switch off or delete people who sign in) | **PASS** |
| 11 | Business owner keeps independent control | DB "2/11" (owner stays OWNER with every power); E2E 11 (a delegate's own business's owner routes refuse while acting; only the owner grants) | **PASS** |
| 12 | Multiple venues/branches do not mix data | DB "6/12" (branch-limited delegate sees only its branch); E2E R1 (`?branchId=` of another branch returns nothing); Phase 22 suite 68/68 (venue isolation) | **PASS** |
| 13 | Directories show the correct approved businesses | DB "5/13" (owned + hosted listed, managed and suspended not); E2E 13 | **PASS** |
| 14 | Organization QR resolves to the public URL | 22b E2E: SVG byte-equal to a QR of `/groups/<slug>?src=qr` | **PASS** |
| 15 | Business QR resolves to its booking page | 22b E2E: byte-equal to `/company/<slug>?src=qr` | **PASS** |
| 16 | Booking from an organization page | `qa-booking-e2e.mjs` 22/22 (real browser from `?org=`) | **PASS** |
| 17 | Attribution without duplicate bookings | 22b DB "O" (one attribution row, booking untouched, forged slug credits nobody) | **PASS** |
| 18 | Standalone businesses keep working | E2E 18; every earlier suite (17, 19, 20, 21, 22, booking E2E) green | **PASS** |
| 19 | Arabic and English | 22b E2E (ar/en titles, hreflang); delegate UI bilingual; sweep ar + en over every delegate page | **PASS** — sweep: 544 page loads (anonymous, owner, admin and the new delegate role × ar/en × 375/768/1024/1440): one axe finding, `scrollable-region-focusable` on a report table at 375px — fixed (report tables are now labelled, focusable regions); re-sweep of delegate (104 loads) and owner (144 loads): **0 flagged** |
| 20 | Mobile and desktop | E2E 20: banner, nav and exit at 390px and 1440px, no overflow; sweep at 375/768/1024/1440 | **PASS** — sweep: 544 page loads (anonymous, owner, admin and the new delegate role × ar/en × 375/768/1024/1440): one axe finding, `scrollable-region-focusable` on a report table at 375px — fixed (report tables are now labelled, focusable regions); re-sweep of delegate (104 loads) and owner (144 loads): **0 flagged** |
| 21 | Migrations preserve existing data | mig: counts of Business, Booking, Customer, Payment, Service, StaffMember, User, Review, Organization, association identical around a re-run of both files; legacy TENANT → HOSTED, FRANCHISE → MANAGED; migrated rows carry no scopes; both files applied twice cleanly | **PASS** |
| 22 | Relationship changes are auditable | DB "4/22"; E2E 22 (invite, accept, grant, operate.start, parent.set all in the audit log) | **PASS** |
| 23 | Circular relationships rejected | DB "23/25" (cycle, 4th level, self, foreign parent); E2E 23 (409); SQL probe of the trigger | **PASS** |
| 24 | Large lists paginate safely | DB "24" (120 associations → 3 pages of 50, page clamp, no duplicates across pages); 22b DB "X" (150-tenant directory) | **PASS** |
| 25 | No unbounded traversal or recursive rendering | DB "23/25" (public page shows parent + direct children only; a grandchild never appears); depth ≤ 3 enforced by trigger | **PASS** |
| 26 | Existing booking, payment, notification, subscription regressions | Vitest 1203 passed (booking engine, payments, notification outbox, plans); 17: 13/13, 19: 21/21, 20: 19/19, 21: 44/44, 22: 68/68, booking E2E 22/22, security 32/32 | **PASS** — see note |

**Note on 26.** In two full-suite runs earlier on this branch, three
booking-contention tests in `reliability.db.test.ts` timed out (60 s). They
pass alone (13/13), and an alternating A/B of six full-suite runs (this
branch vs `phase-22b-audit`) passed 6/6. The branch changes nothing in the
booking engine, database client or scheduling. Recorded as an
intermittent, load-dependent timeout, not a regression; the final run
passed.

### Code-review regressions (independent review of this phase's diff)

| # | Defect found | Proof it is fixed | Result |
|---|---|---|---|
| R1 | `?branchId=` widened a branch-limited delegate's bookings | E2E R1 | PASS |
| R2 | `GET /api/business` exposed the full record to staff/delegates; `PUT` echoed it | E2E R2 ×2 | PASS |
| R3 | Spend gated on REPORTS (MANAGED can hold it), not FINANCE; sort by spend leaked ranking | E2E R3 ×2 | PASS |
| R4 | STAFF delegates saw login numbers and could switch off or delete people who sign in | E2E R4 ×3 | PASS |
| R5 | Every staff member could list colleagues' time off | E2E R5 (staff manager token: 403) | PASS |
| R6 | A stale or forged acting cookie locked the owner out of their own pages | E2E R6 (browser: cleared, billing reachable) | PASS |
| R7 | One-owner index let a pending invite block the real owner; forbade per-branch ownership by one org | DB "one owner…" (concurrent accepts: exactly one), "one organization may own several branches" | PASS |
| R8 | Live bookings stream refused delegates (endless 409 reconnects) | E2E R8 (event stream served) | PASS |
| R9 | A parent's owner could not detach a child | route rewritten to compute both sides' authority | PASS (code) |
| R10 | Delegation resolved several times per request | `cache()` per request; one shared `isActingElsewhere` | PASS (code) |

---

## Phase 22b matrix (A–AB, retained)


One row per required test (owner's list A–AB). "DB" =
`src/lib/organizations/phase22b.db.test.ts` on the QA Postgres; "E2E" =
`scripts/qa-phase22b.mjs` over HTTP against a production build with real
sessions; "unit" = Vitest files named; "browser" = Playwright + axe
probes. Results are recorded only from actual runs (all on 2026-10-31,
local QA; nothing here is a production claim).

| # | Requirement | How it is proved | Where | Last result |
|---|---|---|---|---|
| A | Create a mall organization | Register → PENDING → platform approves → owner publishes (E2E, kind BUSINESS_GROUP; kinds incl. MALL accepted by schema, unit); venues attach to organizations via the Phase 22 admin flow, re-run green | E2E + unit + Phase 22 suite | PASS |
| B | Create a restaurant-group organization | Register with kind BUSINESS_GROUP; no venue; two brands listed, each keeping its own owner | DB | PASS 14/14 |
| C | Create a clinic-group organization | Same path, kind BUSINESS_GROUP; isolation rows Q/S cover records | DB | PASS 14/14 |
| D | Add newly created businesses | Email invite → `acceptEmailInvite` inside onboarding's transaction → association APPROVED on creation; replayed token rolls the whole creation back (DB); invite link lifecycle incl. public read and cancel (E2E) | DB + E2E | PASS |
| E | Invite existing businesses | Organization invites by slug → owner sees it named → accepts → listed | E2E | PASS 83/83 |
| F | Accept and reject invitations | Accept one, decline another; a declined row is never listed and cannot be re-accepted | DB + E2E | PASS |
| G | Prevent unauthorized association | Stranger 404, anonymous 401, organization cannot answer its own invitation (409), business cannot use another's branch, pending org cannot recruit or be joined, suspended org re-checked at acceptance and claim | DB + E2E | PASS |
| H | Remove a business without deleting its data | Remove association; business row, services, bookings counts unchanged; still bookable | DB + E2E | PASS |
| I | Businesses listed under the correct organization | Two organizations, overlapping tenants; each page lists only its own approved ones, before and after removal | DB | PASS 14/14 |
| J | A business in multiple approved locations | One brand: branch 1 in mall A, branch 2 in group B; each directory shows its branch; whole-business overlap refused (and under concurrency, via advisory lock) | DB | PASS 14/14 |
| K | Public organization URL resolution | `/groups/<slug>` 200 published; pending, approved-unpublished and suspended 404 | E2E | PASS 83/83 |
| L | Organization QR encodes the canonical public URL | The endpoint's SVG equals a locally generated QR of `/groups/<slug>?src=qr` byte for byte (same decode); PNG served; public gets 401 | E2E | PASS 83/83 |
| M | Business QR resolves to the booking page | `/api/business/qr` SVG equals a locally generated QR of `/company/<slug>?src=qr` | E2E (regression) | PASS 83/83 |
| N | Booking from an organization directory | Directory carries `/company/<slug>?org=<org>`; a real browser walks the widget from that URL and books | E2E + browser (`qa-booking-e2e.mjs` §4b) | PASS 22/22 |
| O | Booking attribution correctness | Attribution row for N; a forged slug books fine and credits nobody; double call writes once; direct bookings unattributed; the booking row untouched | DB + E2E + browser | PASS |
| P | Cancellation and rescheduling | The widget suites (cancel from the manage link, retry-once) re-run green on this build | E2E (`qa-booking-e2e.mjs` 22/22, suites 17/19 green) | PASS |
| Q | Organization manager authorization | Manager runs associations and profile; cannot publish, appoint members, or reach another organization (404) | DB + E2E | PASS |
| R | Independent ownership preserved | `ownerId` unchanged after invite/accept/remove; services intact; email-invited business belongs to its creator | DB + E2E | PASS |
| S | Cross-organization and cross-business isolation | Manager of A has no authority over B; metrics are counts only — asserted to contain no name/phone/price strings | DB + E2E | PASS |
| T | Arabic/English rendering | `/groups/<slug>` and `/en/groups/<slug>`: titles, content, hreflang (E2E); browser sweep ar/en | E2E + browser (`qa-phase18.mjs`) | PASS |
| U | Mobile responsive behaviour | 375px and 1440px, ar/en, no horizontal overflow, axe serious/critical = 0 on `/groups`, `/groups/qa18-group`, `/org-admin`, `/org-admin/[id]`, `/dashboard/organizations` | browser (`qa-phase18.mjs`) | PASS — 440 loads, 0 flagged, 0 serious/critical axe, no overflow |
| V | SEO metadata and canonical URLs | title/description per language, canonical, noindex-when-empty, index-when-listed | unit (`organizations.test.ts`) + E2E | PASS |
| W | Organization with no businesses | Page renders, noindex (E2E); the sitemap's `businesses > 0` filter sees 0 for it (DB) | E2E + DB | PASS |
| X | Organization with hundreds of businesses | 150 approved tenants load under 5s and page at 24/page (DB); 300-entry paging, filters, clamp (unit) | DB + unit | PASS |
| Y | Optional access module disabled | No provider configured: pages, bookings, dashboards fine; access area absent/unavailable | E2E (Phase 23 extends) | NOT RUN — Phase 23 |
| Z | External provider unavailable | Provider outage never touches booking paths (Phase 23 jobs) | DB (Phase 23) | NOT RUN — Phase 23 |
| AA | Visitor credential revocation | Cancel → credential revoked via provider confirmation (Phase 23) | DB (Phase 23) | NOT RUN — Phase 23 |
| AB | Existing business and booking regression | Full earlier QA set re-run on this build | E2E suites 17–22 | PASS — 17: 13/13, 19: 21/21, 20: 19/19, 21: 44/44, 22: 68/68 (re-run after review fixes), security: 32/32, booking E2E: 22/22 (re-run after review fixes), venue console + venue page clean, vitest 1179 passed (re-run in the completion audit) |

## Completion audit additions (2026-10-31)

| Defect | Requirement it touched | Proof | Result |
|---|---|---|---|
| D1 media, city and kind not editable | A (profile/media) | E2E: browser saves city, upload controls present, logo saved through the API | PASS |
| D9 rename without re-review | A, G (trust) | E2E: rename → PENDING, offline, cannot republish, re-approval restores | PASS |
| D10 unescaped name in email | security | unit: hostile name escaped, subject on one line | PASS |
| D2 unlimited invites and member lookups | G (abuse) | E2E: the 11th lookup is 429 | PASS |
| D3 sitemap frozen at build | V (SEO) | unit: revalidate 3600; build shows the revalidate column | PASS |
| D8 reason never shown | A (review) | E2E: the organization reads the suspension reason | PASS |
| D6 any image URL accepted | security | unit (fails on `main`), E2E 422 | PASS |
| D7 metrics count disagreed | S (metrics) | DB: delete a business, counts agree | PASS |
| D5 internal field leaked | S | DB: response shape | PASS |
| D4 fractional page | X (paging) | unit (fails on `main`) | PASS |
| D11 owner self-appointment | Q (authority) | E2E 409 | PASS |
