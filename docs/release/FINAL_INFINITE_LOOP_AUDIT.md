# Final infinite-loop and unbounded-processing audit

Final audit, 2026-11-05. An independent static review of the whole
repository (web, crons, workers, database, mobile) that did not rely on the
earlier loop audits (`docs/qa/*_LOOP_AUDIT.md`), followed by fixes,
regression tests and the browser and API loop scripts.

This is evidence for bounded behaviour under the conditions examined. It is
not a proof that no loop can exist.

## Result

- **One reproducible loop was found and fixed:** a redirect loop for a
  revoked web session (F-27).
- **Bounds that only gave way at volume were fixed** (F-28, F-29): a cron
  with no deadline, and queries that could return the same rows every run.
- **No other reproducible unbounded loop remains** in the code examined.
- Residual risks are listed at the end, each with its bound.

## Defects found and fixed

| ID | Source | Trigger | Before | After (bound) | Test |
|---|---|---|---|---|---|
| F-27 | `src/auth.config.ts` (proxy) ↔ `dashboard/layout.tsx`, `onboarding/page.tsx` | Session revoked (password reset, "sign out everywhere", deleted user) while a cookie remains | Proxy saw a signed-in cookie and bounced `/login` → `/dashboard`; the layout's database check said signed out → `/login`; repeated until the browser's ~20-hop limit | The proxy no longer bounces sign-in pages. `/login` and `/signup` layouts decide with the database-checked `auth()` (`lib/auth/signed-in-home.ts`), so a revoked session sees the form | `src/lib/auth/auth-page-loop.test.ts` (fails without the fix: 3 of 5) |
| F-28 | `src/lib/automations/run.ts`, `api/cron/operations` | A busy day: thousands of follow-ups | No deadline, so a run killed by the platform never reached renewals, notices or retries | 240 s deadline under `maxDuration` 300; jobs past it are skipped and reported in `skipped`; retries now run before new messages | `run-deadline.test.ts` |
| F-28 | Every cron without an explicit limit (`notifications`, `reminders`, `subscriptions`) | Slow run | Platform default limit | `export const maxDuration = 300`; runs recorded in `CronRun` | Type-checked; `withCronRun` tests |
| F-29 | `lib/bookings/slot-waitlist.ts` sweep | More than 200 waiting business-days | `distinct` + `take` with no order: possibly the same 200 every run | Soonest days first (`date asc`) | Existing waitlist tests (134 booking tests pass) |
| F-29 | `lib/entitlements/ledger.ts` auto-resume | More than 500 paused memberships | 500 read in no order and not-yet-due ones skipped, so due ones could be missed | Only pauses that have run out, soonest-due first, in SQL | `auto-resume.db.test.ts` (fails without the fix) |
| F-29 | `lib/payments/reap.ts` | More than 500 stale payments | No order | `createdAt asc, id asc` | Payments DB tests |
| F-13 | `lib/payments/ledger.ts`, `reap.ts` | Overlapping webhook deliveries | A late "fail" could overwrite "paid"; two settles both "changed" | Row lock (`SELECT … FOR UPDATE`) in settle, fail and reap | `ledger-race.db.test.ts` (3 cases fail without the fix) |

## Systems inspected, with their bounds

| Area | Source | Trigger | Bound / termination | Failure state | Evidence |
|---|---|---|---|---|---|
| Notification outbox | `lib/notifications/outbox.ts` | Provider outage | 5 attempts, backoff 2 m/10 m/30 m/2 h, then DEAD; stale PENDING reclaimed after 5 min; 200 per run; undeliverable rows closed | DEAD | `outbox.db.test.ts` (8/8, three consecutive runs) |
| Automation messages | `lib/automations/send.ts` | Same | 100 per run, 5 attempts, DEAD; marketing cap 2/week | DEAD | phase27 DB tests |
| Webhooks | `lib/enterprise/webhooks.ts` | Receiver failing | 8 attempts, backoff to 12 h, 2-min lease, 5 s timeout, 50 per run / 25 s; endpoint auto-disabled after 20 consecutive failures; spent rows closed; feed cursor `(updatedAt, id)` strictly advances | DEAD / DISABLED | `phase28.db.test.ts` (7/7), `qa-phase28` 46/46 |
| Access sync | `lib/access/sync.ts`, `reconcile.ts` | Provider outage | 6 attempts, backoff 30 s–1 h, DEAD; 50 per batch, 30 s deadline; pending passes given up after 24 h; re-issue ≤ 5 | DEAD | `qa-phase23-loops` 15/15 |
| Waitlist offers | `slot-waitlist.ts` | Cancellations | ≤ 3 offers per entry, conditional updates; a cancel offers once | EXPIRED | phase27 tests |
| Loyalty | `lib/loyalty/ledger.ts` | Earn / redeem / expire | Ledger keyed by `sourceKey`; nothing awards in response to an award | — | phase27 tests |
| Recurring series | `lib/bookings/series.ts` | Create | ≤ 12 occurrences, 1–4 weeks apart (zod) | — | unit tests |
| Organization hierarchy | `phase22c_relationships.sql` trigger | Re-parenting | Recursive CTE `lvl < 10`, cycle check, depth ≤ 3, advisory lock; the only trigger in the schema; writes nothing | Refused | `phase22c.db.test.ts`; `qa-phase28` attempts a cycle |
| Permission resolution | `business-access.ts`, `delegation.ts` | Every request | Flat queries, no recursion | — | static |
| Transactions | `bookings/queue.ts` `withRetries` | Serialization conflict | 4 attempts with jitter; create `INSERT_ATTEMPTS` 6 | Error to caller | reliability DB tests |
| API pagination | `/api/v1/*` | Client walk | `limit ≤ 100`, stable cursors, forged cursor ignored | — | `qa-phase28-perf` (walk of 9.3 k rows) |
| Web booking stream | `lib/realtime/booking-stream.ts` client | Network loss | One EventSource; 8 consecutive failures; backoff 2–30 s | Stops, shows retry | `qa-loops-browser` 9/9 |
| React effects | `src/app`, `src/components`, `src/features` | Renders | Fetching effects have stable dependencies; polls capped (`AccessPanel` `POLL_MAX`, waitlist interval cleared at expiry); debounced saves; listeners removed on cleanup | — | `qa-loops-browser`, `qa-phase23-loops`, static review |
| Locale and auth redirects | `src/proxy.ts`, `auth.config.ts` | Any URL | Every redirect lands on a URL that resolves without a further redirect (F-27 was the exception) | — | `qa-redirects` 108/108 |
| Mobile auth refresh | `mobile/lib/api/client.ts` | 401 | One single-flight refresh per request (`_retried`), with a timeout; "ended" signs out once | Signed out | Mobile unit tests (240) |
| Mobile queries | `mobile/lib/query` | Errors | No retry on 4xx; 3 on network errors; exponential backoff ≤ 8 s; mutations never retried; polls time-boxed | — | static |
| Mobile navigation, deep links, listeners | `mobile/app`, `+native-intent.tsx` | Navigation, taps | Index gate once per focus; no back-redirects; `+native-intent` is a pure mapping; push, AppState, NetInfo, Linking listeners removed; taps de-duplicated | — | static review (mobile audit) |

## Remaining risks (not reproduced; bounded)

| Risk | Bound today | When it would matter | Suggested work |
|---|---|---|---|
| Operations jobs restart from the first id each run | 2,000 rows per job, 240 s deadline | Thousands of businesses with daily follow-ups | Stored cursor or rotating start |
| Points-expiry and renewal notices ordered by account id | `take 2000` | More than 2,000 accounts with points expiring in one week | Order by "last notified" |
| Reminders: 1,000 nearest bookings per hourly run | 1,000, nearest first | More than 1,000 confirmed bookings in the next 12–24 h | Cursor or more frequent run |
| `WebhookDelivery`, `NotificationDelivery`, `AccessEvent` never pruned | Indexed; per-run work is bounded | Feed's "known deliveries" query grows with history | Retention prune; `bookingId` column |
| Realtime SSE polls the database every 3 s per open dashboard tab, hidden or not | Stream rotates every 280 s; reconnects bounded | Many idle tabs | Pause while `document.hidden` |
| Loyalty expiry "poison" lot (insert refused, remaining > 0) | 500 per run | Only if an `expire:<id>` row exists with points left — no code path found that does this | PLAUSIBLE only; watch logs |
| Disabled webhook endpoint keeps PENDING deliveries; re-enabling sends the backlog | 50 per run | Long-disabled endpoints | Expire deliveries older than N days |
