# Security operations runbook

Who does what when a secret leaks, a user is compromised, a deploy goes
wrong, or data has to be restored. Read with `docs/security/THREAT_MODEL.md`
and `docs/security/SECURITY_REPORT.md`.

## 1. Environments and secrets

| Environment | Where | Database | Secrets |
|---|---|---|---|
| Production | Vercel, `main` | Neon (production) | Vercel env, scope Production |
| Preview | Vercel, per PR | **should** be a Neon branch or the QA set; today as configured | Vercel env, scope Preview — must not hold production Paymob/WhatsApp keys (S-04) |
| Local | developer machine | Docker `maw3ed-qa` :5450 | `.env.development.local` (gitignored); `.env` must not hold production credentials |

Rules:
- Every variable the code reads is declared in `src/lib/env.ts` and
  documented in `.env.example` (`env-coverage.test.ts` fails otherwise).
- Mark every secret "Sensitive" in Vercel so it cannot be read back.
- Nothing on a developer machine connects to the production database;
  migrations are run by the owner from a controlled shell.

### Rotation procedure

Rotate immediately on suspicion; otherwise yearly. Order: add the new
value → deploy → revoke the old at the provider.

| Secret | Effect of rotating | How |
|---|---|---|
| `AUTH_SECRET` (`NEXTAUTH_SECRET`) | **Signs every web session, mobile token and rate-limit key.** Rotating signs everybody out of web and app; rate-limit windows restart | Generate 32+ random bytes; set in Vercel; redeploy |
| `PSEUDONYM_SECRET` | Keys the `PhoneRelease` hashes. **Do not rotate.** The plaintext numbers are not stored, so the rows cannot be re-keyed: a new value silently drops the recycled-number fence for every number released before it. If it ever leaks, the exposure is the ability to test whether a given number was released — accept that over losing the fence, and record the decision | Set once before this phase deploys; store the value in the owner's password manager as well as Vercel |
| `DATABASE_URL` | None for users | Neon: reset password → update Vercel → redeploy |
| `PAYMOB_HMAC_SECRET` | Callbacks signed with the old secret are refused (403) until Paymob is updated | Paymob dashboard → Security → regenerate; update Vercel; redeploy; resend any callback that failed in between |
| `PAYMOB_API_KEY` | New sessions and refunds use it | Paymob dashboard → API keys |
| `WHATSAPP_ACCESS_TOKEN` | Sends fail (`FAILED http-401`) until updated; the outbox retries them | Meta Business → System user → new token |
| `RESEND_API_KEY` | Emails fail until updated; retried by the outbox | Resend → API keys |
| `CLOUDINARY_API_SECRET` | Uploads fail until updated | Cloudinary → settings |
| `CRON_SECRET` | Vercel sends the new value automatically after redeploy | Vercel env |
| `EXPO_ACCESS_TOKEN` | Push sends fail until updated | expo.dev → access tokens |
| `SENTRY_AUTH_TOKEN` | Builds stop uploading source maps (errors still arrive, stack traces less readable) | Sentry → Settings → Organization Tokens → new token; update Vercel; revoke the old |

## 2. Account and session incidents

| Situation | Do |
|---|---|
| A customer reports their account used by somebody else | `POST /api/account/sessions {everywhere:true}` as them is self-service; from the database: `UPDATE "User" SET "sessionsRevokedAt" = now() WHERE id = '<id>'` and `DELETE FROM "MobileSession" WHERE "userId" = '<id>'` (**WRITE**). Web tokens die within 5 minutes, app tokens within 15 |
| An owner's email account was compromised | Reset their password (ends all sessions) and check `AuditLog` for `account.password_reset`; review bookings cancelled in the window |
| An administrator leaves | `UPDATE "User" SET "adminRole" = NULL, "sessionsRevokedAt" = now() WHERE id = '<id>'`; the role is read per request, so access ends at once |
| A staff member leaves | The owner removes access in the dashboard (`StaffMember.access = NULL`); it ends on their next request |
| A phone number is reported recycled while an old account still exists | Until S-02 is built: delete the old account on the previous holder's request (support), which fences the history |
| A booking link was shared or leaked | The token cannot be rotated today; cancel and rebook, or ask the business to |

Audit trail: `AuditLog` (admin actions, money, account events). Read
with `SELECT at, "actorRole", action, "resourceType", "resourceId", summary FROM "AuditLog" ORDER BY at DESC LIMIT 100`.

## 3. Backups and restore

**Provider:** Neon, project `MAW3ED` (`small-lab-69857640`, AWS
us-east-1), branch `production` (`br-spring-frost-an7g6g13`). Confirmed
in the console on 2026-10-29: the organisation is on the **Free plan**,
so point-in-time restore covers only the **last 6 hours**, there are
**no snapshots and no snapshot schedule** (schedules need a paid plan),
and the branch is **not protected** (it can be reset or deleted from the
console). Encryption at rest and in transit is the provider's.

That is the current backup position, and it is thin (S-06). Three
things close it, in order of value:

1. **Protect the production branch** (Settings → Branch protection →
   Protect): stops an accidental reset or delete. Free.
2. **Create a snapshot now and after every migration** (Backup &
   Restore → Create snapshot). Manual on Free; a schedule (daily, keep
   7–30 days) comes with the Launch plan, which also extends the
   history window to 7 days.
3. **An off-site copy**: `.github/workflows/db-backup.yml` dumps the
   database every Monday (and on demand from the Actions tab), encrypts
   it with AES-256 under `BACKUP_PASSPHRASE`, and keeps it as a GitHub
   artifact for 90 days — a dozen restore points on a provider other
   than Neon. It needs two repository secrets the owner sets once
   (GitHub → Settings → Secrets and variables → Actions):
   `DATABASE_URL_UNPOOLED` and `BACKUP_PASSPHRASE` (32+ random
   characters, also kept in the password manager — without it a dump
   cannot be opened). Run it once by hand after setting them and check
   the artifact appears.

**Restore drill, 2026-10-29, on isolated local infrastructure:** the QA
database (`postgres:17-alpine`) was dumped with `pg_dump -Fc` (213 KB,
sha256 `0562455a…3463a`), restored with `pg_restore --no-owner` into a
fresh container in 1 s, and compared: all ten checked tables matched
row for row (`User` 29, `Business` 12, `Booking` 74, `Payment` 35,
`Refund` 4, `NotificationDelivery` 856, `AuditLog` 112, `StaffMember` 7,
`Resource` 4, `Review` 8); the three overlap constraints, the receipt
sequence and the `lower(email)` index were present in the copy. Script:
the session scratchpad's `restore-drill.sh` (steps below). Production
restore was **not** rehearsed: it would need a Neon branch or a second
project the owner creates.

Procedure (production):
1. Neon console → the project → Restore (point in time) **into a new
   branch**, never over the live branch.
2. Point a Preview deployment's `DATABASE_URL` at the branch; check
   `/api/version`, a business page, the dashboard.
3. If the live branch must be replaced: announce, put the site in
   maintenance (Vercel: pause the project or deploy a holding page),
   promote the branch or re-point production's `DATABASE_URL`, redeploy,
   run the smoke test in `BOOKING_OPERATIONS.md` § 10.
4. Record what was restored, to which point, and what was lost between
   that point and the incident (bookings made in that window must be
   re-entered from the owners' notifications).

Procedure (dump/restore, any Postgres):
```
pg_dump "$SOURCE_URL" -Fc -f maw3ed.dump
pg_restore --no-owner --no-privileges -d "$TARGET_URL" maw3ed.dump
# then: SELECT count(*) FROM "Booking"; SELECT conname FROM pg_constraint WHERE conname LIKE 'booking_no_overlap%';
```

## 4. Deploy, rollback, migrations

- CI (`.github/workflows/ci.yml`): typecheck, lint, dependency audits
  (web high / mobile critical), tests with a floor on the count, build.
  A red check blocks the merge.
- Rollback: Vercel → Deployments → previous → "Promote to Production"
  (instant). A rollback does **not** undo a migration; migrations are
  additive and idempotent so old code runs on a migrated database, but
  check `PHASE_STATUS.md` → "Production migrations" before rolling back
  across a migration.
- Migration safety: hand-written SQL in `prisma/migrations/`, each
  `IF NOT EXISTS`, with pre-checks that print a NOTICE rather than
  failing when data stops a constraint; run **before** the code that
  needs it deploys; never `prisma db push` or `migrate diff` against a
  real database (they drop hand-made objects).
- Dependency updates: `npm audit` is in CI; Dependabot or a monthly
  `npm outdated` review is the owner's choice.

## 5. Monitoring and alerting

Today: Vercel runtime logs (JSON lines from `lib/logger`), the admin
pages (`/admin/notifications`, `/admin/payments/diagnostics`,
`/admin/audit`), the cron responses, and **Sentry** (project `maw3ed` in
org `website-builder-l5`, https://website-builder-l5.sentry.io; every
`log.error` is forwarded with personal data redacted, `src/instrumentation.ts`).
The DSN is public by design and is in Vercel as `SENTRY_DSN` and
`NEXT_PUBLIC_SENTRY_DSN`. An alert rule ("Maw3ed: new, escalating or
regressed issue") emails the team; source maps upload at build through
`SENTRY_AUTH_TOKEN` (org token `vercel-sourcemaps-maw3ed`; rotate from
Sentry → Settings → Organization Tokens, then update Vercel).
**Not configured:** a Vercel log drain, uptime checks (S-03). Minimum to
set up: a Vercel log drain; an uptime check on `/api/version`; an alert when `/api/cron/notifications` reports `dead >
0` or the webhook logs `handler threw`.

What to look at weekly: `NotificationDelivery` DEAD rows; `AuditLog`
`payment.*` entries; refunds PENDING over a day; `WebhookEvent` with
`processedAt IS NULL`; Vercel 5xx rate.

## 6. Incident response (summary; the policy is `docs/legal/INCIDENT_RESPONSE_POLICY.md`)

1. **Contain**: rotate the secret involved (§ 1); revoke sessions
   (§ 2); if payments are affected, change the Paymob HMAC secret and
   pause deposits (`depositEnabled` per business, or withhold the Paymob
   keys) until understood.
2. **Preserve**: export the relevant `AuditLog`, `WebhookEvent`,
   `NotificationDelivery` rows and Vercel logs for the window before
   anything is cleaned.
3. **Assess**: which assets (threat model § Assets), how many people,
   what data.
4. **Notify**: affected customers and businesses in plain language;
   Paymob if money is involved; the regulator where the law requires
   (counsel decides timing and content — see the policy).
5. **Recover**: restore from backup if integrity is in doubt (§ 3);
   redeploy a known-good build.
6. **Learn**: a written post-incident note in `docs/security/`, with
   the findings log updated.

Roles: the owner is incident lead and the only person with production
credentials; engineering support on request. There is no on-call
rotation; the owner's contact is the one on `/contact`.
