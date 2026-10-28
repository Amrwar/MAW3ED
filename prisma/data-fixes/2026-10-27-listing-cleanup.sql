-- Listing clean-up from the Oct 27 website audit. Production data, run by hand.
--
-- Not a migration: nothing in the schema changes, and parts of it are
-- judgement calls about real listings. Run it in a psql session in
-- three passes:
--
--   1. The SELECTs, to see what each step would touch.
--   2. The statements in section A, which are safe as written.
--   3. Whichever lines in section B you agree with, uncommented.
--
-- Everything is wrapped in a transaction: check the output, then
-- COMMIT, or ROLLBACK to leave the data as it was.

BEGIN;

-- ─── A. Safe as written ─────────────────────────────────────────────

-- English category names that say what the Arabic says. "صالونات حلاقة"
-- is barber shops; the English read "Salons". prisma/seed.ts has the
-- same names, so a re-seed agrees.
UPDATE "Category" SET "nameEn" = 'Barbershops & Salons' WHERE slug = 'salons';
UPDATE "Category" SET "nameEn" = 'Medical Clinics'      WHERE slug = 'clinics';

-- The misspelling the audit found, wherever it is. Case by case, so a
-- capitalised name keeps its capital.
SELECT id, slug, "nameAr", "nameEn" FROM "Business"
 WHERE "nameEn" ILIKE '%psychologycal%' OR "nameAr" ILIKE '%psychologycal%' OR "taglineAr" ILIKE '%psychologycal%';
UPDATE "Business" SET
  "nameEn"    = replace(replace(replace("nameEn", 'psychologycal', 'psychological'), 'Psychologycal', 'Psychological'), 'PSYCHOLOGYCAL', 'PSYCHOLOGICAL'),
  "nameAr"    = replace(replace(replace("nameAr", 'psychologycal', 'psychological'), 'Psychologycal', 'Psychological'), 'PSYCHOLOGYCAL', 'PSYCHOLOGICAL'),
  "taglineAr" = replace(replace(replace("taglineAr", 'psychologycal', 'psychological'), 'Psychologycal', 'Psychological'), 'PSYCHOLOGYCAL', 'PSYCHOLOGICAL')
 WHERE "nameEn" ILIKE '%psychologycal%' OR "nameAr" ILIKE '%psychologycal%' OR "taglineAr" ILIKE '%psychologycal%';
UPDATE "Service" SET
  "nameEn" = replace(replace(replace("nameEn", 'psychologycal', 'psychological'), 'Psychologycal', 'Psychological'), 'PSYCHOLOGYCAL', 'PSYCHOLOGICAL'),
  "nameAr" = replace(replace(replace("nameAr", 'psychologycal', 'psychological'), 'Psychologycal', 'Psychological'), 'PSYCHOLOGYCAL', 'PSYCHOLOGICAL')
 WHERE "nameEn" ILIKE '%psychologycal%' OR "nameAr" ILIKE '%psychologycal%';

-- ─── B. Look first, then decide ─────────────────────────────────────

-- BerryGum: a web design studio filed under Education, at
-- /company/amr-hefny. It is not something a customer books, so the
-- cleanest fix is taking it off the public site; the other two lines
-- are the alternatives if it should stay listed.
SELECT b.id, b.slug, b."nameAr", b."nameEn", c.slug AS category, b."isPublished"
  FROM "Business" b JOIN "Category" c ON c.id = b."categoryId"
 WHERE b.slug = 'amr-hefny' OR b."nameEn" ILIKE '%berry%' OR b."nameAr" ILIKE '%berry%';
-- UPDATE "Business" SET "isPublished" = false WHERE slug = 'amr-hefny';
-- UPDATE "Business" SET "categoryId" = (SELECT id FROM "Category" WHERE slug = 'consulting') WHERE slug = 'amr-hefny';
-- Changing the address breaks links already shared to the old one (there is no redirect from old slugs):
-- UPDATE "Business" SET slug = 'berrygum' WHERE slug = 'amr-hefny';

-- Bookable services with no price: they show "Price not set". Either
-- the owner sets one in the dashboard, or a genuinely free service
-- stays at 0 and reads as free once its name says so.
SELECT b.slug, s."nameAr", s."nameEn", s.price, s.duration
  FROM "Service" s JOIN "Business" b ON b.id = s."businessId"
 WHERE b."isPublished" AND s."isAvailable" AND s.price = 0
 ORDER BY b.slug;

-- Businesses whose every service is 30 minutes, which is the form's
-- default rather than a real length. For the owners to check; nothing
-- here can know the right durations.
SELECT b.slug, b."nameAr", count(*) AS services
  FROM "Service" s JOIN "Business" b ON b.id = s."businessId"
 WHERE b."isPublished" AND s."isAvailable"
 GROUP BY b.id, b.slug, b."nameAr"
HAVING min(s.duration) = 30 AND max(s.duration) = 30 AND count(*) > 1;

-- Published businesses with no English name, which the English site
-- then shows in Arabic. Owners add it under Settings → Profile.
SELECT slug, "nameAr" FROM "Business" WHERE "isPublished" AND ("nameEn" IS NULL OR "nameEn" = '');

-- COMMIT;   -- or ROLLBACK;
