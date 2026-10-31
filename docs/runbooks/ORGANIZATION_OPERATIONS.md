# Organization operations runbook (Phase 22b)

For the platform operator. Production database access is run by the
owner by hand; nothing here is automated.

## Reviewing organizations

Registrations arrive as **PENDING** in `/admin/venues` → "الجهات". A
pending organization has no public page, cannot publish, cannot invite
or be joined.

- **Approve** when the registrant plausibly represents the named
  organization. The name and kind you approve are what the public sees.
- **Reject / Suspend** require a written reason. The organization sees
  it in its console. Suspension unpublishes the page and stops all
  recruiting, including invitations sent earlier (pending invites can no
  longer be accepted or claimed). Listed businesses are untouched and
  keep taking bookings on their own pages.
- **Re-review after a rename.** If an approved organization changes its
  name or kind, it goes back to PENDING and offline automatically
  (audit action `org.identity.changed`, with the old and new values in
  its metadata). Compare them before approving again.

## Migration and rollback

`prisma/migrations/phase22b_organizations.sql` is additive and
idempotent: new enums, columns with defaults, new tables, a recreated
role check, a one-time backfill (existing operator rows → APPROVED), and
`VenueRole_scope_unique` (duplicates merged first, oldest kept). The
audit fixes of 2026-10-31 added **no** migration.

### Rolling the code back (Vercel instant rollback)

The schema can stay. Older code ignores the new tables and columns.
**One exception:** `VenueRoleKind.ORGANIZATION_OWNER` is a value the
pre-22b Prisma client does not know. Prisma rejects unknown enum values
when it reads them, so a role row of that kind would make the old
code's role queries fail. *(This follows from how Prisma handles enums.
It was not executed against a pre-22b build.)*

Before rolling back to a pre-22b deployment, if any owner roles exist,
run this on production:

```sql
-- Re-express owners as managers, which the old code understands.
-- Re-running is safe. Keep the ids to restore them afterwards.
CREATE TABLE IF NOT EXISTS "_rollback_org_owner_roles" AS
  SELECT id FROM "VenueRole" WHERE kind = 'ORGANIZATION_OWNER';
-- An owner who also appointed themselves manager of the same
-- organization would collide with VenueRole_scope_unique: drop the
-- redundant manager row first (the owner row carries the authority).
DELETE FROM "VenueRole" a USING "VenueRole" o
  WHERE a.kind = 'ORGANIZATION_ADMIN' AND o.kind = 'ORGANIZATION_OWNER'
    AND a."userId" = o."userId" AND a."organizationId" = o."organizationId";
UPDATE "VenueRole" SET kind = 'ORGANIZATION_ADMIN' WHERE kind = 'ORGANIZATION_OWNER';
```

After re-deploying 22b or later:

```sql
UPDATE "VenueRole" SET kind = 'ORGANIZATION_OWNER'
  WHERE id IN (SELECT id FROM "_rollback_org_owner_roles");
DROP TABLE "_rollback_org_owner_roles";
```

### Removing the schema (not recommended)

Dropping the organization tables destroys associations, invites, view
counts and attribution history. Prefer fixing forward. If it must be
done, first take a Neon branch snapshot. Then drop, in this order:
`OrganizationBookingAttribution`, `OrganizationView`,
`OrganizationInvite`, `OrganizationBusiness`, the `VenueOrganization`
columns added by the migration, then the enums. Removing an enum value
(`ORGANIZATION_OWNER`) is not possible in PostgreSQL without recreating
the type. Leave it in place.

## Known operational limits

- **Sitemap.** It regenerates hourly (`revalidate = 3600`). A newly
  published organization appears in it within the hour. If the database
  is unreachable at regeneration, that hour's sitemap lists static
  routes only, and the next hour repairs it.
- **Ownership transfer.** An organization's owner cannot hand ownership
  over from the console. The platform does it with
  `/api/admin/venue-roles` (grant `ORGANIZATION_OWNER` to the new
  account), then removes the old role.
- **Invite links.** Possession of the token is the credential. A link
  forwarded to someone else works for them. It is single-use, expires
  after 14 days, and can be cancelled from the console.
