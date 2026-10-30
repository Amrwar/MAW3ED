# Organization platform — acceptance matrix

One row per required test (owner's list A–AB). "DB" =
`src/lib/organizations/phase22b.db.test.ts` on the QA Postgres; "E2E" =
`scripts/qa-phase22b.mjs` over HTTP against a production build with real
sessions; "unit" = Vitest files named; "browser" = Playwright + axe
probes. Results are recorded only from actual runs.

| # | Requirement | How it is proved | Where | Last result |
|---|---|---|---|---|
| A | Create a mall organization | Register → PENDING → platform approves → owner publishes; venue attached | E2E | — |
| B | Create a restaurant-group organization | Register with kind BUSINESS_GROUP; no venue; brands listed | DB | — |
| C | Create a clinic-group organization | Same path, kind BUSINESS_GROUP (clinics); isolation row S covers records | DB | — |
| D | Add newly created businesses | Email invite → onboarding with the invite token → association APPROVED on creation | DB + E2E | — |
| E | Invite existing businesses | Organization invites by slug → owner sees it → accepts | E2E | — |
| F | Accept and reject invitations | Accept one, decline another; declined is not listed | DB + E2E | — |
| G | Prevent unauthorized association | A stranger, business staff and another organization's manager get 404; a business cannot approve itself | E2E | — |
| H | Remove a business without deleting its data | Remove association; business row, bookings, customers unchanged | DB | — |
| I | Businesses listed under the correct organization | Two organizations, overlapping tenants; each page lists only its own approved ones | DB + E2E | — |
| J | A business in multiple approved locations | One brand: branch 1 in mall A, branch 2 in group B; each shows its branch | DB | — |
| K | Public organization URL resolution | `/groups/<slug>` 200 published; draft/pending/suspended and unknown 404 | E2E | — |
| L | Organization QR encodes the canonical public URL | Decode the SVG/PNG target: `https://…/groups/<slug>?src=qr` | E2E | — |
| M | Business QR resolves to the booking page | Existing `/api/business/qr` target unchanged | E2E (regression) | — |
| N | Booking from an organization directory | Directory → business page with `?org=` → widget → booking created by the existing engine | E2E | — |
| O | Booking attribution correctness | Attribution row for N; none for a direct booking; never a second booking or customer | DB + E2E | — |
| P | Cancellation and rescheduling | The attributed booking cancels and reschedules exactly as before | E2E (existing suites) | — |
| Q | Organization manager authorization | Manager can profile/invite/approve; cannot add members, publish, or touch another organization | DB + E2E | — |
| R | Independent ownership preserved | ownerId, staff, services, customers, money untouched by associate/remove | DB | — |
| S | Cross-organization and cross-business isolation | Manager of A reads nothing of B; organization metrics carry no customer fields | DB + E2E | — |
| T | Arabic/English rendering | `/groups/<slug>` and `/en/groups/<slug>`: content, dir, hreflang | E2E + browser | — |
| U | Mobile responsive behaviour | 375px, no horizontal overflow, axe clean | browser | — |
| V | SEO metadata and canonical URLs | title/description per language, canonical, noindex-when-empty | unit (`seo`) + E2E | — |
| W | Organization with no businesses | Page renders, says so, noindex, not in sitemap | E2E | — |
| X | Organization with hundreds of businesses | 150 approved tenants: page 1 renders with pagination; search narrows | DB + E2E | — |
| Y | Optional access module disabled | No provider configured: pages, bookings, dashboards fine; access area says unavailable | E2E (Phase 23 extends) | — |
| Z | External provider unavailable | Provider outage never touches booking paths (Phase 23 jobs) | DB (Phase 23) | — |
| AA | Visitor credential revocation | Cancel → credential revoked via provider confirmation (Phase 23) | DB (Phase 23) | — |
| AB | Existing business and booking regression | Full earlier QA set re-run | E2E suites 17–22 | — |
