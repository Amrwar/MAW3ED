# Phase 20 report: security, privacy and operational hardening

Date: 2026-10-29. Branch `phase-20-security`, on `main` after PR #35
(Phase 19). Read with `docs/security/THREAT_MODEL.md`,
`docs/security/SECURITY_REPORT.md`, `docs/runbooks/SECURITY_OPERATIONS.md`
and the drafts in `docs/legal/`.

## How this phase was run

1. Every authentication, authorisation, data-handling and operations
   path was read: NextAuth and the mobile token code, OTP, password
   reset, the rate limiter, the admin and business guards, every API
   route's guard (a script mapped all 101 routes to the guard each
   uses), uploads, redirects, outbound fetches, raw SQL, the CSP and
   headers, the logger, account deletion, CI, environments.
2. The threat model was written from that (assets, boundaries, threats,
   what stands in the way, what does not).
3. Gaps were fixed in code with tests; owner and legal items were
   written down with an owner each rather than claimed done.
4. Verified three ways: unit tests, a Postgres test for deletion and the
   recycled number, and two HTTP scripts against a production build — the
   existing cross-tenant/role probes and a new Phase 20 script with a
   real browser session (CSRF, uploads, export, revocation, caps, OTP
   burning, admin discoverability). A backup/restore drill ran on an
   isolated local container.
5. A code review of the diff, with its findings applied (end of this
   report).

## Existing functionality discovered (verified, kept)

Most of what Parts B–E ask for was already in place and is listed in
`SECURITY_REPORT.md` § 2: per-request role and ownership checks from
the database, tenant scoping on every business route, OTP generation
and attempt counting, bcrypt, rotating mobile refresh tokens with reuse
detection, HMAC-verified replay-safe webhooks, hashed reset and
verification tokens, nonce CSP and the other headers, PII redaction in
logs, hashed rate-limit keys, parameterised SQL, no user-controlled
outbound requests, safe `?next=`, clean web dependency audit.

## Changes implemented

**Part A — threat model:** `docs/security/THREAT_MODEL.md` (assets,
boundaries, threats and mitigations, the Eterna credential design
note).

**Part B — authentication:**
- Web sessions are revocable: `User.sessionsRevokedAt`; the JWT is
  re-checked against the account every 5 minutes and refused once
  revoked or deleted; explicit 30-day `maxAge`; password reset and a
  new "sign out everywhere" (`POST /api/account/sessions {everywhere:true}`)
  set it and end app sessions.
- MFA for privileged accounts: **not built**; recorded as the top
  residual risk (S-01) with the owner's interim measure.

**Part C — authorisation:** audited every route; `route-guards.test.ts`
fails on a new unguarded route that is not deliberately listed as open;
the realtime stream re-reads ownership instead of trusting the token.

**Part D — data protection:**
- The deletion question answered: **yes**, booking history keyed by a
  phone number became visible to a newly created account on that
  number after a deletion. Fixed: deletion records a keyed hash of the
  number (`PhoneRelease`), a later account for it carries
  `historySince`, and every reader of the account's bookings, payments
  and reviews is fenced (`ownedWhere`); the previous holder's name is
  not reused; the delivery ledger loses the address; the deletion is
  audited. Retention of the bookings themselves was **not** changed.
- `GET /api/account/export`: a JSON attachment of the account's own data.
- Audit entries for deletion, password reset and mass sign-out.
- Retention schedule, deletion and anonymisation policies, secret
  rotation and backup procedures documented; restore drill performed.

**Part E — application security:** upload magic-byte and folder checks;
Origin check on cookie-authenticated mutations (CSRF second line);
profile-view counter rate-limited; mobile `zod` under advisory upgraded
and four Expo advisories fixed; CI dependency-audit gates.

**Part F — compliance:** six drafts in `docs/legal/` with facts,
decisions and legal questions separated; no compliance claimed.

**Part G — operations:** `SECURITY_OPERATIONS.md` (environments,
rotation table, account incidents, backups and the drill, deploy and
rollback, migration safety, monitoring gaps, incident steps); CI gates.

## Database changes

`prisma/migrations/phase20_security.sql` — **run on production before
this PR deploys** (sign-in reads the new columns on every check):
`User.sessionsRevokedAt`, `User.historySince`, table `PhoneRelease`.
Idempotent. Applied to the local QA database for every test below, and **applied to production on 2026-10-29** by the owner (with the Phase 17–19 files, all verified present by query).

**`PSEUDONYM_SECRET` is set in Vercel (all three environments, 2026-10-29).** It was required before deploy (32 random
bytes; never rotate — `docs/runbooks/SECURITY_OPERATIONS.md` § 1). Without
it the deleted-phone hashes are keyed on `AUTH_SECRET` and would be lost
the first time that is rotated.

## Tests executed

| Suite | Result |
|---|---|
| Web typecheck, lint | PASS (lint 0 errors, 7 pre-existing warnings) |
| Mobile typecheck, lint, unit tests (after the `zod` 3→4 bump) | PASS (17 test files) |
| Unit + route tests (`npm run test:run`) | PASS — 1038 passed, 70 skipped (1108; 99 files) — 2026-10-29 (Phase 19: 1024) |
| New unit tests: `origin.test.ts` (5), `session-policy.test.ts` (3), `image-sniff.test.ts` (2), `route-guards.test.ts` (3), `deletion.test.ts` updated | PASS |
| `src/lib/account/deletion.db.test.ts` (Postgres) | PASS — the previous holder's upcoming/past bookings, payments and name are invisible to the next account on the number; the businesses keep the records; the ledger address is scrubbed; the deletion is audited |
| `scripts/qa-security.mjs` (bearer tokens: cross-tenant reads/writes, forged claims, role differences, admin 404, injection) | PASS — 32/32 |
| `scripts/qa-phase20.mjs` (browser session: headers, CSRF C1–C5, uploads U1–U4, export, sign-out-everywhere, view cap, OTP burning, admin discoverability) | PASS — 19/19 |
| Dependency audits | web production: 0 advisories; mobile production: 11 remain (6 high, 5 low), all in the Expo toolchain — see S-07 |
| Backup/restore drill (isolated container) | PASS — 10/10 tables match, constraints and sequence present (`SECURITY_OPERATIONS.md` § 3) |
| Phase 17/18/19 regression suites | PASS (unit; the Phase 19 DB suites unchanged) |

### Tests NOT RUN / BLOCKED

- Production restore (needs a Neon branch the owner creates); production
  backup window not observed.
- MFA (not built).
- Automated scanning beyond `npm audit` and the project's own probes
  (no DAST tool configured); a third-party penetration test is
  recommended before the Eterna work.
- Live secret rotation.

## Regression results

All prior suites pass; the only behavioural changes a user could notice
are: a session signed in before a password reset is signed out within
five minutes; a cross-site POST carrying the session cookie gets 403; an
upload whose bytes are not the declared image type is refused.

## Security findings

`SECURITY_REPORT.md`: ten findings fixed (S-F01…S-F10), fourteen residual
risks with owners (S-01…S-14). Critical: none known. High: S-01 (admin
MFA) open with an interim measure; S-F01 and S-F02 fixed.

## Performance findings

The session re-check adds one indexed `User` read per signed-in user
per five minutes. The Origin check is a header comparison in the proxy.

## Known limitations

- Revocation reaches a web session within five minutes, not instantly.
- A dormant, undeleted account on a recycled number is still reachable
  by the number's new holder (S-02).
- The retention periods are proposals; nothing purges today.
- The legal drafts need counsel and the owner's decisions before they
  replace the live pages.

## Remaining work

Owner: run `phase20_security.sql`; set `SENTRY_DSN`; separate Paymob
keys per environment and mark secrets sensitive; confirm the Neon backup
window and add an off-site monthly dump; decide retention periods,
minimum age, refund terms; engage counsel on the drafts. Engineering:
admin MFA (S-01), dormant-account step-up (S-02), Expo SDK upgrade
(S-07), password denylist (S-11), Vercel Firewall rules (S-08).

## Release readiness

Ready to merge once the migration has run. No public URL or mobile API
contract changed; `/api/account/export` and `{everywhere:true}` are
additions.

## Next phase dependencies

None technical. The Eterna credential work should start from the
threat model's note.

## Code review of this phase's changes

A review of the whole diff ran before this report (`/code-review`,
high effort). Eight findings; all addressed:

| # | Finding | What was done |
|---|---|---|
| 1 | The origin check exempted all of `/api/auth/`, leaving the project's own cookie-authenticated routes there (`verify-email/send`, `signup`, `reset-password`) outside the second line | Only NextAuth's own actions (`callback`, `signin`, `signout`, `csrf`, `session`, `providers`, `error`, `_log`) and the bearer-only `/api/auth/mobile/*` are exempt; test added |
| 2 | The realtime stream checked ownership once at connect, then streamed customers' names for the connection's life | Ownership and `sessionsRevokedAt` re-read every 30 s inside the poll; 30-minute lifetime ceiling, after which the client reconnects and the connect check runs again |
| 3 | Profile-view limit keyed per address across all listings would under-count mobile visitors behind carrier NATs; limiter ran before parsing, so junk cost a write | Keyed per listing and address (hashed), 60/h, after the body and slug are known; doc comment corrected |
| 4 | "Sign out everywhere" left the asking browser signed in for up to five minutes | The response clears the session cookie under both NextAuth names; other browsers are refused within five minutes |
| 5 | `PhoneRelease` hashes were keyed on `AUTH_SECRET`, which is rotated on a leak — rotating would silently drop the recycled-number fence | Dedicated `PSEUDONYM_SECRET` (declared, documented as never rotated, owner must set it before deploy); fallback to the signing secret locally only |
| 6 | Three inline audit writes with a hard-coded `customer` role (a password reset is often an owner's) | One helper, `lib/account/audit-event.ts`, that derives the role from the account and writes inside the caller's transaction when given one |
| 7 | (same as 3) | — |
| 8 | Blocking CI on `high` advisories ties every build to upstream publications; the mobile step installed the whole Expo toolchain | Critical blocks; high is reported without blocking; the mobile audit reads the lockfile only |

After the fixes: typecheck and lint clean, the full unit suite, the
Postgres deletion test and both HTTP probe scripts were re-run on a fresh
build (results above).
