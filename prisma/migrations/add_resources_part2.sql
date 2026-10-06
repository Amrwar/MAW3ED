-- Part two: move the tables into resources, and point the overlap
-- constraint at the new column.
--
-- Split from part one because the ResourceKind enum has to be committed
-- before a statement can cast to it.

-- ── Every Table becomes a Resource, under the same id ───────────────
--
-- Reusing the id is what makes this safe: Booking.resourceId can be
-- filled straight from Booking.tableId, both foreign keys stay valid,
-- and nothing has to be matched up by name.
INSERT INTO "Resource" (
  "id", "businessId", "branchId", "kind", "name", "capacity",
  "area", "notes", "photo", "isActive", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  t."id",
  t."businessId",
  NULL,
  'TABLE'::"ResourceKind",
  t."name",
  t."capacity",
  -- tableType described where the table was, which is what `area` is
  -- for. The enum itself does not survive: a corner is not a different
  -- kind of thing to book, it is a corner.
  CASE t."tableType"
    WHEN 'CORNER'  THEN 'زاوية'
    WHEN 'MIDDLE'  THEN 'وسط'
    WHEN 'OUTDOOR' THEN 'خارجي'
    WHEN 'WINDOW'  THEN 'نافذة'
    WHEN 'FAMILY'  THEN 'عائلي'
    WHEN 'PRIVATE' THEN 'خاص'
    WHEN 'BAR'     THEN 'بار'
    WHEN 'BOOTH'   THEN 'كابينة'
    ELSE NULL
  END,
  t."notes",
  t."photo",
  t."isActive",
  0,
  t."createdAt",
  t."updatedAt"
FROM "Table" t
WHERE NOT EXISTS (SELECT 1 FROM "Resource" r WHERE r."id" = t."id");

UPDATE "Booking"
SET "resourceId" = "tableId"
WHERE "tableId" IS NOT NULL AND "resourceId" IS NULL;

-- ── The constraint follows the booking ──────────────────────────────
--
-- Same rule as before, with resourceId in place of tableId. For every
-- row that exists today the two are equal, so nothing changes meaning;
-- from here on it is the resource that is held.
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_no_overlap";

ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap"
EXCLUDE USING gist (
  "businessId" WITH =,
  COALESCE("staffMemberId", '-') WITH =,
  COALESCE("resourceId", '-') WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE (
  "startsAt" IS NOT NULL
  AND "endsAt" IS NOT NULL
  AND "endsAt" > "startsAt"
  AND "status" IN ('PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS')
);
