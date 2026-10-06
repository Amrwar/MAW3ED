-- The customer record a business actually works from.
--
-- Customer already held a name, a phone, an email and notes. What it
-- could not do was say anything *about* somebody — that this one is a
-- regular, that this one has missed two appointments, that this one
-- prefers the quiet chair. Tags are that.
--
-- Everything else the CRM shows — visits, cancellations, no-shows,
-- total spend, first and last seen — is counted from Booking at read
-- time and is not stored here. A stored count is a count that can be
-- wrong, and there is no reason for one: a business has hundreds of
-- bookings, not millions.

ALTER TABLE "Customer"
  -- Free-text labels, scoped to the business that wrote them. An array
  -- rather than a join table: a tag has no properties of its own, and
  -- the whole point is that a business invents its own vocabulary.
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}',
  -- When the notes were last touched, so the profile can say so.
  ADD COLUMN IF NOT EXISTS "notesUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Finding a customer by tag. GIN over the array alone: a composite
-- with businessId would need the btree_gin extension to index a text
-- column alongside it, and the businessId filter is already served by
-- the index below.
CREATE INDEX IF NOT EXISTS "Customer_tags_idx"
  ON "Customer" USING GIN ("tags");

-- The list is searched by name and by phone constantly; neither was
-- indexed, so every search scanned the table.
CREATE INDEX IF NOT EXISTS "Customer_businessId_createdAt_idx"
  ON "Customer" ("businessId", "createdAt");
