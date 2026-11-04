# Phase 26 report: SEO, marketplace discovery, growth and analytics

Date: 2026-11-04. Branch `phase-26`, from `main` at `a9138f8` (#53, staging).

## Inspection first

Four read-only audits came first (technical SEO, search, analytics and
permissions, business acquisition). Each finding acted on was checked in
the code before it was changed; three were wrong and are not acted on:

| Claim | Verdict |
|---|---|
| The analytics route mixes UTC and Cairo days | Not a bug: `Booking.date` is the Cairo calendar day stored at UTC midnight (`lib/bookings/instants.ts`) |
| Sign-up drops English users into Arabic onboarding; the billing link is not localized | Not a bug: `/onboarding` and `/dashboard` are single-address sections that follow the saved language |
| The home page has no business sign-up entry | Not a bug: `WhyJoin` links to `/signup?type=business` and `/for-business` |

What already existed and was kept: privacy-first daily view counters
(`ProfileView`, `OrganizationView`), `Booking.source`, organization booking
attribution, landing-page rules that 404 empty combinations, hreflang on
every page, honest `aggregateRating`, and fabricated marketing content
already removed in earlier phases.

## What was built

| Part | Change |
|---|---|
| 1 SEO | Business breadcrumbs → landing pages (were robots-blocked search URLs); `/demo` bilingual and noindex; help centre in the sitemap; honest `lastModified`; one-hop locale redirects (kept temporary, see the review); Organization/ShoppingCenter/Place JSON-LD with no ratings; FAQPage; listing ItemList numbering; help 404 metadata. `docs/seo/SEO_AUDIT.md` |
| 2 Search | Arabic folding on both sides (`normalize.ts` and the identical SQL `maw3ed_search_norm`, generated `searchKey` columns, trigram indexes); English plurals; five-word cap; a unique tie-breaker on every sort; "open now"/"today" honour closures and the badge's past-midnight rule; "online payment" only where the plan allows deposits (filter and card) |
| 3 Organizations | "Places and groups" above search results (published, with at least one listed business); `/groups` name search and malls/groups filter, empty directories hidden; the app's groups API searches the same way |
| 4 Acquisition | No rating or growth figures in the `/for-business` mock-up and a visible "not real figures" label; a "list your business" link on business pages; acquisition funnel (for-business → pricing → demo → sign-up → registered) |
| 5 Funnel | Browser-reported steps counted once per tab per day (`FunnelCount` + keyed-hash `FunnelSeen`, no identifiers); recorded steps from `Booking`/`Payment`; business report `/dashboard/reports/funnel`. `docs/analytics/EVENT_TAXONOMY.md`, `CONVERSION_FUNNELS.md` |
| 6 Org analytics | Directory referrals, bookings per visit, category engagement, venue activity; attributed bookings exclude test bookings and abandoned checkouts; counts only for every relationship type |
| 7 Business analytics | Analytics page: abandoned checkouts no longer counted, repeat = >1 completed booking, `null` not `0` for no data, Cairo month, one shared calculation (no duplicate first fetch), "completed booking value" labelled honestly, bilingual KPI cards. Reports: revenue and performance by appointment day, one no-show rule, new customers by first real booking, `?days=` clamped |
| 8 Performance | Search measured before/after at 50k names; page baseline. `docs/performance/PERFORMANCE_BASELINE.md` |
| 9 Loops | Audit below; two real fixes (pagination tie-breaker, analytics double fetch) |

## Requirements

| Requirement | Status |
|---|---|
| Public pages use correct SEO metadata | PASS (QA 1.1–1.14) |
| No fabricated review schema | PASS (QA 1.8, 1.10; no rating without reviews, none on organizations) |
| Search/filtering produces correct results | PASS (QA 2.1–2.8) |
| Organization pages are discoverable | PASS (QA 3.1–3.6) |
| Analytics events consistent and deduplicated | PASS (QA 5.1–5.6, browser F1–F5) |
| No known infinite pagination or redirect loops | PASS (QA 1.14, 2.7; unit tests) |
| Performance changes have measurements | PASS (search: before/after; pages: baseline) |
| Existing functionality remains reliable | see Tests |
| Hosted malls see no private customer or financial information | PASS (QA 6.5, 6.6) |
| Never invent ratings, reviews, counts or services | PASS |

## Loop and data-fetching audit (Part 9)

| Risk | Finding | Evidence |
|---|---|---|
| Infinite pagination | Web pager bounded (`MAX_PAGE`), past-the-end redirects once to the last page; mobile stops at `pageCount` | QA 2.7 |
| Repeated cursor values | **Fixed:** sorts ended on `createdAt`, so tied rows could swap between OFFSET pages (a business shown twice, another never). Every sort now ends on `id` | QA 2.7 (all five sorts, tied `createdAt`) |
| Search refetch loops | Web search fetches on submit; URL is the state, pushed from events; mobile debounced 350 ms | code review; browser F1 |
| Filter synchronisation loops | `/groups` is a plain GET form; `/businesses` unchanged | — |
| URL redirect loops | None; `/ar?lang=en` collapsed to one hop | QA 1.13, 1.14; unit |
| Platform funnel double counting | **Fixed in review:** summing every business's rows counted tab-and-business pairs; each step is now also counted once per tab site-wide and the platform reads only that | QA 5.6 |
| Revalidation loops | No `revalidatePath`/`revalidateTag` added; sitemap regenerates hourly | grep |
| Repeated analytics events | Browser dedup + server dedup; eight concurrent reports count once; reload sends nothing | QA 5.2; browser F1, F3 |
| Infinite scroll without termination | Mobile `getNextPageParam` stops at `pageCount`; stops on error | code review |
| Cache invalidation storms | No cache tags exist | — |
| Webhook attribution loops | Attribution is written once, at booking creation (`!reused`), never by a webhook; funnel counters are written only by the public endpoint | grep |
| **Fixed:** analytics page double fetch | The page rendered this month on the server and then fetched it again on mount (with a browser-local month) | browser G1, G2 |

## Code review

`/code-review high a9138f8..648200d`: 10 findings, 9 fixed.

| # | Finding | Outcome |
|---|---|---|
| R1 | `searchKey` created plain by `prisma db push` → every search empty | Fixed: `repair_push_gaps.sql` rebuilds each as GENERATED (tested on a scratch database, idempotent) |
| R2 | Closure filters missed one-day blocks without `endsOn`, weekly all-day blocks, blocks with only one time | Fixed: the booking engine's exact rules (`calendar.ts`); QA 2.5 covers both shapes |
| R3 | 308 language redirects skip the cookie on replay | Fixed: back to 307, one hop kept |
| R4 | Platform funnel summed business rows (tab × business) | Fixed: platform-wide row per tab; rates no longer clamped, with a note that visitors enter at any step |
| R5 | "Held" report window spanned days + 1 | Fixed |
| R6 | A website without a scheme became a relative `sameAs` | Fixed, unit-tested |
| R7 | Funnel step marked sent before a beacon could throw | Fixed: marked after a send is queued, fetch fallback |
| R8 | A refused analytics range left the old figures under the new heading | Fixed: an alert says so |
| R9 | Organization console waits for venue metrics in a second round | Accepted (P3): a few organizations run venues; parallel per venue |
| R10 | Unused `stepRate` duplicating the view's rule | Removed |

## Tests

| Command | Result |
|---|---|
| `npx vitest run` | 1204 passed, 171 skipped (database suites) |
| `npx eslint src --quiet` | clean |
| `npx tsc --noEmit` | clean |
| `node scripts/qa-phase26.mjs` | 114/114 (final build, after the review fixes) |
| `node scripts/qa-phase26-browser.mjs` | 35/35 (20 screens × axe + 390 px, both languages; funnel once per tab) |
| `node scripts/qa-responsive.mjs` | 380 page loads, 10 devices × 2 languages, none wider than its screen |
| `node scripts/qa-phase26-perf.mjs` | `docs/performance/PERFORMANCE_BASELINE.md` |
| Regression battery (first build) | qa-phase24 147/147, qa-phase24-browser 23/23, qa-redirects 108/108, qa-offline-qr 31/31, qa-booking-e2e 22/22, qa-phase23 48/48, qa-phase23-loops 15/15, qa-security 32/0, qa-phase23-browser 49/49, qa-loops-browser 9/9, qa-venue-console clean, qa-venue-page clean, qa-phase22c 59/59, qa-phase22 68/68, qa-phase21 44/44, qa-phase19 21/21, qa-phase17 13/13, qa-phase18 462 loads 0 flagged |
| qa-phase22b (final build) | 84/84 — its metrics check updated: an attributed booking still waiting for payment counts once paid (the Phase 26 rule) |

Two test-harness fixes: `qa-responsive` opens English pages at `/en/…`
(through the saved-language redirect, WebKit on plain-http localhost kept
`upgrade-insecure-requests` and rendered pages unstyled — 25 false
overflow reports); the regression runner passes it the server address.

## Production steps (owner)

1. **Done 2026-11-04:** `prisma/migrations/phase26_search_funnel.sql` applied
   on production by the owner and verified (8 generated search columns
   filled, 2 trigram indexes, funnel tables, 11 steps, folding identical
   to the application). Originally: run it **before** merging (the new code reads `searchKey` and writes the funnel tables).
   Additive and idempotent; it rewrites eight small tables once to add the
   generated columns. Rollback: `prisma/migrations/rollback/phase26_search_funnel_rollback.sql`
   after reverting the code.
2. Merge; check `/businesses?q=احمد`, `/groups`, `/sitemap.xml`, and a
   business page's breadcrumbs.

## Open items

| Item | Owner |
|---|---|
| The mobile app reports no funnel steps (its bookings are recorded) | Phase 27+ |
| "Most booked" sort counts every booking, cancelled included (a relation count Prisma cannot filter) | Open, P3 |
| Rating filter has no minimum review count | Open, P3 (real data, shown with its count) |
| Per-route Open Graph images | Open, P3 |
| Analytics charts' own axis labels are still Arabic-only (KPI cards are bilingual) | Open, P3 |
| Production verification of all of the above | After merge, owner |
