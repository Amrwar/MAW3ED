# Performance baseline — Phase 26

Date: 2026-11-04. Machine: the QA workstation (local production build,
`next start`, QA Postgres 17 in Docker). Absolute numbers are this
machine's, not production's: they are the baseline later runs compare
against, with the same script.

```
node scripts/qa-phase26-perf.mjs http://localhost:3101 --out perf.json
```

## 1. Search — before and after (the Phase 26 change)

The one change in this phase that alters query cost. Measured on a
scratch database with **50,000** fictional business names
(`EXPLAIN ANALYZE`, PostgreSQL 17):

| Query | Before: `ILIKE` on name/English name/tagline | After: folded `searchKey` + trigram index |
|---|---|---|
| "احمد" — common word (stored as "أحمد") | 69.6 ms, sequential scan, **0 matches** | 2.1 ms, bitmap index scan, 4,169 matches |
| "49999" — rare term | 64.9 ms, sequential scan | 0.1 ms, bitmap index scan |
| "مستشفي" (typed with ي) | 0 matches | 5,000 matches |

The folding fixes recall (searches that found nothing now find the right
businesses) and the trigram index makes the scan sub-linear. Services
carry the same index; categories, cities, districts, staff, organizations
and venues are small tables and are scanned.

## 2. Pages (Chromium, 390 × 812, five fresh loads, median)

| Page | TTFB | DOM ready | Load | LCP | JS (KB) | Requests |
|---|---|---|---|---|---|---|
| `/` | 29 | 175 | 243 | 180 | 418 | 20 |
| `/businesses` | 30 | 116 | 188 | 380 | 431 | 28 |
| `/businesses?q=عيادة` | 33 | 107 | 184 | 364 | 543 | 24 |
| `/businesses?q=عياده احمد` | 27 | 156 | 166 | 332 | 428 | 24 |
| `/cairo/salons` (landing) | 46 | 78 | 209 | 248 | 413 | 29 |
| `/groups` | 25 | 105 | 183 | 132 | 388 | 22 |
| `/company/<slug>` | 63 | 199 | 288 | 260 | 388 | 29 |
| `/for-business` | 24 | 186 | 256 | 200 | 388 | 27 |
| `/en` | 40 | 181 | 251 | 188 | 418 | 20 |

All times in milliseconds. JS is the bytes the browser received for scripts
(Content-Length when sent, else the body), the same way on every run. The `?q=عيادة` page loads the map chunk because
its results have pins (the larger JS figure); the other search does not.

## 3. Server (20 sequential requests after one warm-up)

| Endpoint | p50 | p95 |
|---|---|---|
| `GET /api/public/businesses` | 27 | 44 |
| `…?q=عيادة` | 50 | 59 |
| `…?q=عياده احمد` (two words, folded, widened) | 90 | 96 |
| `…?available=open-now` (with the closure checks) | 14 | 17 |
| `GET /api/public/groups?q=مول` | 16 | 19 |

## What Phase 26 adds per page

- **Funnel reporting:** one `sendBeacon` per step per tab per day, after
  the page is interactive; never blocks rendering. The client module is a
  few hundred bytes in the existing chunks (no new library).
- **"Places and groups":** two indexed queries (`take: 3`), only on the
  first page of a search with a query.
- **Business pages:** one extra `<script type="application/ld+json">` on
  organization and venue pages; a one-line link on business pages.
- **Analytics page:** one fewer request (the duplicate first fetch is gone).

## Cache behaviour

- No user-specific content is cached. Public listing APIs keep their short
  CDN `s-maxage` (unchanged); dashboard, reports and the funnel endpoint
  are dynamic and uncached.
- Facets and price bounds are still computed per request: on today's data
  they are a few milliseconds, and caching them would show stale counts
  right after a business publishes. Revisit if `/businesses` TTFB grows.
- The sitemap regenerates hourly (`revalidate = 3600`), unchanged.

## Watch items

| Item | Threshold to act |
|---|---|
| Multi-word widened search (90 ms p50 here) | > 300 ms p95 in production: precompute synonym-expanded terms or move matching to a single `searchKey` on Business that includes service names |
| `/company/<slug>` TTFB, the slowest page | > 400 ms p95 in production |
| Facets per request | `/businesses` TTFB > 300 ms p95 |
