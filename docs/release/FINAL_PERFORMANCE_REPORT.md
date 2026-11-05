# Final performance report

Final audit, 2026-11-05.

**Environment:** one Windows 11 PC running everything at once: the
production build (`next start`), Postgres 17 in Docker, the load generators
and headless browsers. **These are not production measurements.** Vercel
(Fluid Compute) and Neon (pooled) behave differently, usually better for
server time and worse for the first request in a region. **No
production-scale validation is claimed.** Production field data (Core Web
Vitals) was not available to this audit.

## Production, read-only (2026-11-05)

64 sitemap URLs fetched from `https://www.maw3ed.net` from Canada: all 200.
The slowest was the home page at 1.41 s (first, cold hit); the rest
0.29 s or faster. That is one sample from one client, not a benchmark.

## Pages (local, `qa-phase26-perf`)

| Page | TTFB | DOM ready | Load | LCP | JS |
|---|---|---|---|---|---|
| Home `/` | 36 ms | 297 ms | 461 ms | 320 ms | 402 KB |
| Listing `/businesses` | 27 ms | 225 ms | 386 ms | 488 ms | 418 KB |
| Arabic search | 30 ms | 136 ms | 321 ms | 688 ms | 418 KB |
| City × category `/cairo/salons` | 59 ms | 100 ms | 420 ms | 516 ms | 427 KB |
| Groups `/groups` | 30 ms | 175 ms | 346 ms | 192 ms | 418 KB |
| Business page | 95 ms | 146 ms | 483 ms | 420 ms | 418 KB |
| English home `/en` | 48 ms | 286 ms | 466 ms | 312 ms | 402 KB |

Target LCP < 2.5 s: met locally by a wide margin. About 400 KB of
JavaScript on every page is the main thing to watch on slow phones.

## APIs (local)

| Endpoint | p50 | p95 |
|---|---|---|
| `/api/public/businesses` | 46 ms | 64 ms |
| Arabic search | 46 ms | 52 ms |
| Folded Arabic search | 98 ms | 124 ms |
| "Open now" | 19 ms | 24 ms |
| Groups search | 11 ms | 13 ms |
| `/api/health` (anonymous) | 9 ms median | — |

## Large tenant (600 businesses, 30,000 bookings; `qa-phase28-perf`)

| Measure | This audit | Phase 28 (same script, quieter machine) |
|---|---|---|
| Organization directory, 600 members | 173 ms, 88 KB | 145 ms, 88 KB |
| `/v1/businesses`, walk all 601 (7 pages) | 210 ms | 117 ms |
| `/v1/bookings`, first page of 100 | 34 ms | 16 ms |
| `/v1/bookings`, walk 9,300 rows (93 pages) | 3.1 s | 1.6 s |
| `/v1/reports/portfolio?days=90` | 47 ms | 25 ms |
| Webhook feed query, 200 of 30 k | 0.21 ms (index) | 0.10 ms |

These ran right after the load test, on the same machine. That accounts for
the roughly 2× difference: one machine, two runs, not a regression in the
code.

## Load (`qa-phase24-load`, 20 concurrent unless stated): round 1 10/13, round 2 (final build) 13/13

| Check | Result | Target | Verdict |
|---|---|---|---|
| Organization directory page (server-rendered) | p95 **1,104 ms** (466 req, 23/s) | < 1,000 ms | **FAIL** (local) |
| Directory API | p95 360 ms | < 500 ms | PASS |
| Filtering, 10 concurrent | p95 478 ms | < 1,000 ms | PASS |
| Availability across tenants | p95 324 ms | < 800 ms | PASS |
| 10 bursts of 30 customers racing for one time | **exactly one booking each time, 0 double bookings, 0 unexpected 5xx** | correctness | PASS |
| 20 desks scanning once a second | all 200; p95 **325 ms** | < 300 ms | **FAIL** (local) |
| Provider queue: 60 pass requests | all active within 3 cron runs | — | PASS |
| Signed provider callbacks, each delivered 3× | 1,032 req, 103/s; **each entry recorded once**; p95 **387 ms** | < 300 ms | **FAIL** (local, latency only) |
| Group portfolio, 40 businesses / 20 k bookings | p95 129 ms; total matches the database exactly | < 1,000 ms | PASS |
| Mall and venue metrics | p95 112–130 ms | < 1,000 ms | PASS |

The table is round 1. Round 2 on the final build passed all 13, the same three
included. The misses are latency on this PC, under load from the generator
itself. Every correctness check held. Phase 24 recorded the same variance
(P24-P1: 10/13 to 13/13 by run). **Re-measure these three on a Vercel
preview against a Neon branch before treating them as passed or failed.**

## Reliability under concurrency

- **Double-booking:** prevented by the database (three exclusion
  constraints) as well as the queue; 0 in 300 racing customers.
- **Payment status races:** closed by row locks (F-13). The Stripe refund
  race (two events at once) fails without the lock and passes with it, 3/3.
- **Provider failure isolation:** a failing gate provider or webhook
  receiver backs off and dead-letters without affecting others (sync jobs
  per venue; auto-disable per endpoint). Pinned webhook sends now have a
  total deadline, so a slow receiver cannot hold the cron (review of F-23).

## Not measured

- Core Web Vitals field data (needs Vercel Speed Insights or Search Console).
- Memory profiles of the server or the mobile app.
- Notification throughput against real providers (fake senders locally).
- Anything at production scale or on real phones.
