# Organization platform — acceptance matrix

One row per required test (owner's list A–AB). "DB" =
`src/lib/organizations/phase22b.db.test.ts` on the QA Postgres; "E2E" =
`scripts/qa-phase22b.mjs` over HTTP against a production build with real
sessions; "unit" = Vitest files named; "browser" = Playwright + axe
probes. Results are recorded only from actual runs (all on 2026-10-31,
local QA; nothing here is a production claim).

| # | Requirement | How it is proved | Where | Last result |
|---|---|---|---|---|
| A | Create a mall organization | Register → PENDING → platform approves → owner publishes (E2E, kind BUSINESS_GROUP; kinds incl. MALL accepted by schema, unit); venues attach to organizations via the Phase 22 admin flow, re-run green | E2E + unit + Phase 22 suite | PASS |
| B | Create a restaurant-group organization | Register with kind BUSINESS_GROUP; no venue; two brands listed, each keeping its own owner | DB | PASS 9/9 |
| C | Create a clinic-group organization | Same path, kind BUSINESS_GROUP; isolation rows Q/S cover records | DB | PASS 9/9 |
| D | Add newly created businesses | Email invite → `acceptEmailInvite` inside onboarding's transaction → association APPROVED on creation; replayed token rolls the whole creation back (DB); invite link lifecycle incl. public read and cancel (E2E) | DB + E2E | PASS |
| E | Invite existing businesses | Organization invites by slug → owner sees it named → accepts → listed | E2E | PASS 67/67 |
| F | Accept and reject invitations | Accept one, decline another; a declined row is never listed and cannot be re-accepted | DB + E2E | PASS |
| G | Prevent unauthorized association | Stranger 404, anonymous 401, organization cannot answer its own invitation (409), business cannot use another's branch, pending org cannot recruit or be joined | DB + E2E | PASS |
| H | Remove a business without deleting its data | Remove association; business row, services, bookings counts unchanged; still bookable | DB + E2E | PASS |
| I | Businesses listed under the correct organization | Two organizations, overlapping tenants; each page lists only its own approved ones, before and after removal | DB | PASS 9/9 |
| J | A business in multiple approved locations | One brand: branch 1 in mall A, branch 2 in group B; each directory shows its branch; whole-business overlap refused | DB | PASS 9/9 |
| K | Public organization URL resolution | `/groups/<slug>` 200 published; pending, approved-unpublished and suspended 404 | E2E | PASS 67/67 |
| L | Organization QR encodes the canonical public URL | The endpoint's SVG equals a locally generated QR of `/groups/<slug>?src=qr` byte for byte (same decode); PNG served; public gets 401 | E2E | PASS 67/67 |
| M | Business QR resolves to the booking page | `/api/business/qr` SVG equals a locally generated QR of `/company/<slug>?src=qr` | E2E (regression) | PASS 67/67 |
| N | Booking from an organization directory | Directory carries `/company/<slug>?org=<org>`; a real browser walks the widget from that URL and books | E2E + browser (`qa-booking-e2e.mjs` §4b) | PASS 22/22 |
| O | Booking attribution correctness | Attribution row for N; a forged slug books fine and credits nobody; double call writes once; direct bookings unattributed; the booking row untouched | DB + E2E + browser | PASS |
| P | Cancellation and rescheduling | The widget suites (cancel from the manage link, retry-once) re-run green on this build | E2E (`qa-booking-e2e.mjs` 22/22, suites 17/19 green) | PASS |
| Q | Organization manager authorization | Manager runs associations and profile; cannot publish, appoint members, or reach another organization (404) | DB + E2E | PASS |
| R | Independent ownership preserved | `ownerId` unchanged after invite/accept/remove; services intact; email-invited business belongs to its creator | DB + E2E | PASS |
| S | Cross-organization and cross-business isolation | Manager of A has no authority over B; metrics are counts only — asserted to contain no name/phone/price strings | DB + E2E | PASS |
| T | Arabic/English rendering | `/groups/<slug>` and `/en/groups/<slug>`: titles, content, hreflang (E2E); browser sweep ar/en | E2E + browser (`qa-phase18.mjs`) | PASS (E2E); browser sweep — see U |
| U | Mobile responsive behaviour | 375px and 1440px, ar/en, no horizontal overflow, axe serious/critical = 0 on `/groups`, `/groups/qa18-group`, `/org-admin`, `/org-admin/[id]`, `/dashboard/organizations` | browser (`qa-phase18.mjs`) | — (running) |
| V | SEO metadata and canonical URLs | title/description per language, canonical, noindex-when-empty, index-when-listed | unit (`organizations.test.ts`) + E2E | PASS |
| W | Organization with no businesses | Page renders, noindex (E2E); the sitemap's `businesses > 0` filter sees 0 for it (DB) | E2E + DB | PASS |
| X | Organization with hundreds of businesses | 150 approved tenants load under 5s and page at 24/page (DB); 300-entry paging, filters, clamp (unit) | DB + unit | PASS |
| Y | Optional access module disabled | No provider configured: pages, bookings, dashboards fine; access area absent/unavailable | E2E (Phase 23 extends) | NOT RUN — Phase 23 |
| Z | External provider unavailable | Provider outage never touches booking paths (Phase 23 jobs) | DB (Phase 23) | NOT RUN — Phase 23 |
| AA | Visitor credential revocation | Cancel → credential revoked via provider confirmation (Phase 23) | DB (Phase 23) | NOT RUN — Phase 23 |
| AB | Existing business and booking regression | Full earlier QA set re-run on this build | E2E suites 17–22 | PASS — 17: 13/13, 19: 21/21, 20: 19/19, 21: 44/44, 22: 68/68, security: 32/32, booking E2E: 22/22, venue console + venue page clean, vitest 1168 passed |
