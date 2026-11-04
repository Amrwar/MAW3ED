# SEO audit — Phase 26

Date: 2026-11-04. Scope: every public route. The standing design (which
pages exist, pagination, languages, soft 404s, robots) is in `docs/seo.md`
and was re-checked, not redesigned. This file records what was found, what
changed, and what was verified.

Verification: `scripts/qa-phase26.mjs` Part 1 (HTTP, production build on
the QA database) and `scripts/qa-phase26-browser.mjs` (axe, 390 px, both
languages); unit tests `locale-routing.test.ts`, `meta.test.ts`,
`jsonld*.test.ts`.

## Findings and fixes

| # | Severity | Finding | Fix | Verified |
|---|---|---|---|---|
| S1 | P1 | Business breadcrumbs (and their BreadcrumbList) linked `/businesses?category=…` and `/businesses?city=…`, which robots.txt disallows: every business page sent its link value and structured data to pages crawlers may not fetch, and none to the landing pages | Crumbs point at `/categories/<cat>` and `/<city>/<cat>`, which a published business always makes exist (`MIN_BUSINESSES = 1`). An unpublished owner preview keeps the search links | QA 1.7 (crumbs, and both targets 200) |
| S2 | P1 | `/demo` (invented bookings and reviews) was indexable, Arabic-only metadata on both addresses, no canonical or hreflang | Bilingual `buildMetadata`, `noindex, follow`; still crawlable so the noindex is read | QA 1.4 |
| S3 | P2 | Help centre (`/help`, 7 articles) absent from the sitemap | Listed, both languages | QA 1.2 |
| S4 | P2 | Every sitemap entry said `lastModified: now` on each hourly regeneration | Listing pages: newest `updatedAt` of the businesses they list; organizations/venues: their own; static pages: none | QA 1.2 |
| S5 | — | `/ar/x` and `?lang=` redirects are 307 (temporary) | **Kept 307** after review: these redirects also save the language cookie, and a browser replays a cached 308 without asking the server, so a later `/ar/` link opened after switching to English would land in English. The canonical tags already name the address to index | QA 1.13, unit |
| S6 | P2 | `/ar/x?lang=en` took two hops | One hop | QA 1.13, unit |
| S7 | P2 | Organization and venue pages had only BreadcrumbList/ItemList | `ShoppingCenter`/`Organization` (name, alternateName, url, logo, image, telephone, address, sameAs, parent/sub-organizations) and `ShoppingCenter`/`Place` (address, geo, opening hours). No rating, review or count | QA 1.10 |
| S8 | P2 | Listing ItemList: positions on a short last page were wrong (used the page's own length), URLs relative, `numberOfItems` was the whole catalogue | Positions by page size, absolute URLs, `numberOfItems` = items listed | QA 1.12 (page 2 starts at 13, absolute URLs) |
| S9 | P3 | `/faq` had no FAQPage data | FAQPage from the same translations the page renders, in the page's language | QA 1.6 |
| S10 | P3 | A missing help article returned `{}` metadata | `notFoundMetadata` (noindex) — the page already 404s | QA 1.5 |
| S11 | P3 | `/for-business` mock-up showed "4.9 ★" and "+12%" under a 10 px muted "Example" | Rating and growth figures removed; "Example — not real figures" in a visible badge | QA 4.1 |
| S12 | — | `/groups` listed organizations with empty directories | Hidden (their pages were already noindex) | QA 3.4 |

## Checked and already correct

- Self-canonical and ar/en/x-default hreflang on every public page; English
  titles and descriptions on `/en/…` (QA 1.3 on six pages).
- `aggregateRating` only with at least one visible review (QA 1.8); no
  invented counts anywhere in structured data.
- Thin pages: city/category combinations without a business 404 with
  noindex; empty organization and venue pages noindex; filtered and
  paginated listings noindex, follow; none of them in the sitemap.
- robots.txt allows `/`, disallows private areas and filtered search, and
  leaves `/demo`, sign-in and sign-up crawlable so their noindex is read
  (QA 1.1).
- Real 404s (`notFound()`), no soft 404 (QA 1.5).
- No redirect loop or chain longer than two hops from seven awkward starts
  (QA 1.14).
- Default Open Graph image (`/og.png`) on every page through `buildMetadata`;
  business pages set their own.

## Not done (with reasons)

| Item | Why |
|---|---|
| Per-route generated Open Graph images (city, category) | The default image is correct and present; a generated image per landing page is a design task with low SEO value. Open |
| Clean directory links (`/company/x` without `?org=`) | `?org=` carries attribution (a booking from a mall's directory is credited to it). The canonical already collapses the variants; the duplicate URLs are not indexed. Accepted |
| `next/image` for organization and directory logos | Small owner-hosted logos with width/height set (no layout shift); the organization logo sits beside the name heading so `alt=""` is correct. Accepted |
| Google rich-result validation | Not run: needs the public site. The JSON-LD was parsed and checked field by field in QA |

## How to re-check

```
node scripts/qa-phase26.mjs http://localhost:3101      # Part 1
node scripts/qa-phase26-browser.mjs http://localhost:3101
npx vitest run src/lib/locale-routing.test.ts src/lib/seo
```
