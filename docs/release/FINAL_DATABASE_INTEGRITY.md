# Final database integrity

Final audit, 2026-11-05. Measured on the local QA database (Postgres 17 in
Docker, `maw3ed_qa`), which has every migration applied. Production and
staging cannot be read from this repository. Their migration state is what
the owner's verify scripts reported, recorded in
`docs/roadmap/PHASE_STATUS.md` § Production migrations.

## Schema

| Measure | QA database |
|---|---|
| Tables | 92 |
| Primary keys | 91. The exception is `VerificationToken` (NextAuth), keyed by a unique `(identifier, token)` |
| Foreign keys | 127 |
| CHECK constraints | 49 |
| Exclusion constraints | 3: `booking_no_overlap`, `booking_no_overlap_staff`, `booking_no_overlap_resource` (GiST on `tsrange(startsAt, endsAt)` over live statuses) |
| Indexes | 333 |
| Triggers | 1: the organization-hierarchy cycle and depth guard |
| Constraints left NOT VALID | 0 |
| SQL migration files | 46 in `prisma/migrations/`, hand-written, idempotent, applied by the owner |

What the database itself refuses (so no application bug can store it):
- **Double-booking:** overlapping live bookings for the same business, staff member or resource (exclusion constraints).
- **HOSTED scopes:** an organization association that is HOSTED carrying scopes, FINANCE on anything but OWNED, a branch row with more than RESERVATIONS (`phase22c_relationships.sql`).
- **Org hierarchy:** cycles and more than 3 levels (trigger).
- **Money:** refunds beyond the amount, ledger entries outside their limits, negative counts (Phase 27/28 CHECKs).
- **Enterprise:** malformed brand colours, webhook URLs that are not http(s), attempts outside 0–8, contract limits out of range.

## Schema drift (Prisma schema vs QA database)

`prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`:
the database has objects the Prisma schema does not declare. All were
created by the SQL migrations on purpose. **Nothing the schema expects is
missing.**

| Extra in the database | Created by |
|---|---|
| `Business_searchKey_trgm`, `Service_searchKey_trgm` (trigram search) | `phase26_search_funnel.sql` |
| `searchKey` generated defaults on 8 tables, `Booking.customerPhoneE164` default | Phase 26 / earlier SQL |
| `User_adminRole_idx`, `Business_status_idx`, `Business_isFeatured_idx`, `Booking_businessId_source_idx` | `add_admin_rbac.sql`, `repair_push_gaps.sql` |
| `MembershipPeriod_membershipId_startsAt_key` | `phase27_operations.sql` |

**Hazard (D-01, P3):** `npm run db:push` or `prisma migrate dev` against a
real database would drop these objects, which would slow search and remove a
uniqueness guarantee. Never run either against staging or production. The
SQL migrations are the source of truth. (The script stays in
`package.json` for local scratch databases only.)

## Referential integrity and retention

- Every foreign key is validated (0 NOT VALID), so no orphan rows can exist
  through them.
- Customer account deletion removes the user and cascades to sessions and
  device tokens. Bookings stay with the businesses, released from the phone
  (`lib/account/deletion.ts`, `docs/legal/ACCOUNT_DELETION_POLICY.md`).
- Tables with no retention prune yet: `WebhookDelivery`,
  `NotificationDelivery`, `AccessSyncJob` (DONE/DEAD), `AccessEvent` (P3, see
  `FINAL_INFINITE_LOOP_AUDIT.md`). `CronRun`, `RateLimit` and the funnel
  are pruned.

## Data-integrity defects fixed in this audit

| ID | Defect | Fix |
|---|---|---|
| F-11 | Rescheduling moved a package or membership visit without re-checking it (use after expiry; stacking two months of visits into one) | `moveEntitlement` in the reschedule transaction; refused with 409 `entitlement-gone` (`move.db.test.ts`) |
| F-12 | A booking revived by a late payment kept its discount but lost the redemption row, so caps could be exceeded | Re-claimed on revival; over-cap flagged (`paymob/route.db.test.ts`) |
| F-13 | Payment status transitions raced (a late decline could overwrite a success) | Row locks (`ledger-race.db.test.ts`) |
| F-15 | Stripe Dashboard refunds raised `refundedCents` without a `Refund` row, so reconciliation always disagreed | Refund row inserted for the difference (`stripe/route.db.test.ts`) |
| F-16 | Plan booking caps counted the UTC month, not Cairo's | `cairoMonthBounds` (`create-month-key.test.ts`) |
| F-18 | An idempotency key could return another business's booking | Scoped to the business |
| F-12 note | The released discount id is kept in an audit row (no schema change) | A `discountId` column on `Booking` would be cleaner, at the cost of a schema change |

## Backup and restore

| Item | State |
|---|---|
| Neon (provider) | Point-in-time restore is a Neon plan feature; the retention window was not verified from this repository (owner) |
| Off-site weekly dump (`.github/workflows/db-backup.yml`) | **Working since 2026-11-05.** The first scheduled run (2026-11-02) dumped 265 KB, then failed at `shred` because Docker had written the file as root, so nothing was uploaded (F-01). Fixed: the containers run as the runner's user. Manual run 42083812601 (2026-11-05) succeeded: 102 tables with data, encrypted artifact kept 90 days |
| Restore drill | Done on QA in Phase 28: 92 tables' row counts, 229 constraints, triggers and 333 indexes identical after `pg_dump` → `pg_restore` (3 s). **Off-site drill passed 2026-11-05:** artifact `maw3ed-db-20261105-1823` decrypted with the passphrase from the owner's password manager and restored into a scratch Postgres 17 database, 0 errors; rows present in every checked table (`scripts/backup-restore-drill.sh`). The passphrase was rotated during the drill because the old one could not be matched; rotate with `scripts/backup-rotate-passphrase.sh` |
| Rollback | Code rollback rehearsed on staging (Phase 28, 5 s each way). Migrations are additive, so older code runs on the newer schema |
