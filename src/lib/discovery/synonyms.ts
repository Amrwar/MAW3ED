import { normalizeSearch } from "./normalize";

/**
 * What a search box query should also match.
 *
 * Search compares text with `contains`, so it found only the exact
 * letters typed: "doctor" missed "Dr Hanem" and the Clinics category,
 * and "عيادة" missed "عيادات طبية" because the plural changes the
 * ending. Two cheap fixes, no search engine needed:
 *
 *   - an Arabic stem: the word without "ال" in front and without the
 *     ة / ات / ين / ون ending, so singular and plural meet;
 *   - a hand-kept list of words people use for the same kind of place,
 *     in both languages.
 *
 * Each word of the query becomes a set of alternatives. A business
 * matches when every word matches one of its alternatives, so "dentist
 * maadi" still means dentists in Maadi, not either one.
 */

/**
 * Words that mean the same kind of place. Lower case, plurals spelled
 * out: groups are matched on the word as typed (less a leading "ال"),
 * never on a stem, or "الرياض" would reach "رياضة" and bring the gyms.
 * Words with a common second meaning are left out ("شعر" is also
 * poetry, "غسيل" any washing).
 */
const GROUPS: readonly (readonly string[])[] = [
  ["doctor", "doctors", "clinic", "clinics", "physician", "دكتور", "دكتورة", "طبيب", "طبيبة", "عيادة", "عيادات"],
  ["dentist", "dentists", "dental", "dentistry", "teeth", "tooth", "أسنان", "اسنان", "سنان"],
  ["barber", "barbers", "barbershop", "haircut", "حلاق", "حلاقة", "صالون", "صالونات", "salon", "salons"],
  ["beauty", "makeup", "nails", "skincare", "facial", "تجميل", "ميكب", "اظافر", "أظافر", "بشرة"],
  ["spa", "massage", "سبا", "مساج", "تدليك"],
  ["gym", "fitness", "workout", "trainer", "جيم", "فيتنس", "رياضة", "مدرب"],
  ["lab", "labs", "laboratory", "معمل", "مختبر", "تحاليل", "تحليل"],
  ["lawyer", "legal", "attorney", "محامي", "محاماة", "قانون"],
  ["photographer", "photography", "photoshoot", "مصور", "تصوير"],
  ["tutor", "teacher", "lessons", "course", "courses", "education", "مدرس", "دروس", "كورس", "كورسات", "تعليم", "تدريب"],
  ["physio", "physiotherapy", "علاج طبيعي"],
  ["psychologist", "therapist", "psychology", "نفسي", "نفسية", "معالج"],
  ["mechanic", "ميكانيكي", "سيارة", "سيارات"],
  ["consultant", "consulting", "consultation", "استشارة", "استشارات", "مستشار"],
];

/** The groups in the folded spelling the query and the stored text share. */
const FOLDED_GROUPS = GROUPS.map((g) => [...new Set(g.map(normalizeSearch))]);

const ARABIC = /[؀-ۿ]/;

/** Words beyond this are dropped: each one is another block of scans. */
export const MAX_WORDS = 5;

/** At most this many alternatives per word: each one is several ILIKE scans. */
const PER_WORD = 10;

function withoutArticle(word: string): string {
  return ARABIC.test(word) && word.startsWith("ال") && word.length > 4 ? word.slice(2) : word;
}

/** "العيادات" → "عياد". Null when nothing is left worth searching for. */
export function arabicStem(word: string): string | null {
  if (!ARABIC.test(word)) return null;
  const w0 = normalizeSearch(word);
  let w = withoutArticle(w0);
  // ة is already folded to ه (normalize.ts), so one ending covers both.
  for (const end of ["ات", "ين", "ون", "ه"]) {
    if (w.endsWith(end) && w.length - end.length >= 3) {
      w = w.slice(0, -end.length);
      break;
    }
  }
  return w.length >= 3 && w !== w0 ? w : null;
}

/**
 * "clinics" → "clinic", "therapies" → "therapy". Contains-matching already
 * finds a plural from its singular, not the other way round, so a plural
 * typed is widened to its singular. Short words are left alone ("gas").
 */
export function englishSingular(word: string): string | null {
  if (!/^[a-z]+$/.test(word) || word.length < 5) return null;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ss") || word.endsWith("us")) return null;
  if (word.endsWith("s")) return word.slice(0, -1);
  return null;
}

/**
 * The query, one entry per word, each the word itself first and then
 * what else may stand in for it. Empty for an empty query.
 */
export function searchTerms(raw: string): string[][] {
  const q = normalizeSearch(raw);
  if (!q) return [];

  return q.split(" ").slice(0, MAX_WORDS).map((word) => {
    const alts = new Set<string>([word]);
    const stem = arabicStem(word);
    if (stem) alts.add(stem);
    const singular = englishSingular(word);
    if (singular) alts.add(singular);

    const bare = withoutArticle(word);
    const group = FOLDED_GROUPS.find((g) => g.includes(word) || g.includes(bare) || (!!singular && g.includes(singular)));
    // A short Latin word is inside too many others to add unasked:
    // "spa" is in "space", "lab" in "label".
    if (group) for (const g of group) if (ARABIC.test(g) || g.length >= 4) alts.add(g);

    // Matching is `contains`, so "doctor" already finds "doctors":
    // drop every alternative that holds a shorter one. The word as
    // typed stays first.
    const all = [...alts];
    const kept = all.filter((a, i) => i === 0 || !all.some((b) => b !== a && a.includes(b)));
    return kept.slice(0, PER_WORD);
  });
}
