/**
 * The one spelling search compares.
 *
 * People type Arabic the way they write it in a chat, not the way a
 * listing spells it: "احمد" for "أحمد", "مستشفي" for "مستشفى", "عياده" for
 * "عيادة", with a stray diacritic or a stretched letter (ـ), and digits in
 * either script. Each of those used to find nothing.
 *
 * Both sides are folded the same way: the query here, the stored names by
 * the database function `maw3ed_search_norm` (prisma/migrations/
 * phase26_search_funnel.sql), which fills a generated `searchKey` column on
 * every searchable table. The two must agree letter for letter; the QA run
 * compares them on the same inputs (scripts/qa-phase26.mjs).
 *
 * Folding:
 *   - lower case (Latin);
 *   - tashkeel U+064B–U+065F, superscript alef U+0670 and tatweel U+0640
 *     removed;
 *   - أ إ آ ٱ → ا;  ة → ه;  ى → ي;  ؤ → و;  ئ → ي;
 *   - Arabic-Indic ٠–٩ and Persian ۰–۹ digits → 0–9;
 *   - runs of whitespace → one space, trimmed.
 *
 * Folding loses distinctions a reader would keep (ة and ه are different
 * letters); for matching, that is the point. Nothing displayed is folded.
 */

const MARKS = /[ً-ٰٟـ]/g;

const FOLD: Record<string, string> = {
  "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا",
  "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};
const FOLD_RE = new RegExp(`[${Object.keys(FOLD).join("")}]`, "g");

export function normalizeSearch(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(MARKS, "")
    .replace(FOLD_RE, (c) => FOLD[c])
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The SQL twin, as installed by the migration. Kept here so the test can
 * assert the two fold tables are the same table.
 */
export const SQL_FOLD_FROM = "أإآٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
export const SQL_FOLD_TO = "ااااهيوي01234567890123456789";
