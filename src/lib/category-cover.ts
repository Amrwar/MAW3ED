/**
 * Picks the wallpaper a business shows when it has not uploaded a
 * cover photo. The wallpaper follows the trade — a spa gets the spa
 * ground and motif, a barbershop gets its own — so an empty profile
 * still reads as the right kind of place.
 *
 * The classes live in globals.css under "Category wallpapers".
 */

/** Slugs that have a wallpaper of their own. */
const KNOWN = new Set([
  "clinics",
  "dentists",
  "labs",
  "salons",
  "beauty-centers",
  "spas",
  "gyms",
  "restaurants",
  "consulting",
  "legal",
  "home-services",
  "car-services",
  "photography",
  "education",
]);

/**
 * Slugs that differ between the seed and older records, mapped onto
 * the wallpaper that fits them. (There used to be a third source, the
 * hard-coded category list on /categories; that page reads the
 * database now.)
 */
const ALIASES: Record<string, string> = {
  medical:     "clinics",
  clinic:      "clinics",
  doctors:     "clinics",
  dental:      "dentists",
  dentist:     "dentists",
  lab:         "labs",
  laboratories:"labs",
  barbershop:  "salons",
  barbers:     "salons",
  salon:       "salons",
  hair:        "salons",
  beauty:      "beauty-centers",
  makeup:      "beauty-centers",
  spa:         "spas",
  massage:     "spas",
  gym:         "gyms",
  fitness:     "gyms",
  sports:      "gyms",
  restaurant:  "restaurants",
  cafes:       "restaurants",
  food:        "restaurants",
  consultants: "consulting",
  business:    "consulting",
  law:         "legal",
  lawyers:     "legal",
  home:        "home-services",
  maintenance: "home-services",
  cars:        "car-services",
  automotive:  "car-services",
  photo:       "photography",
  studio:      "photography",
  tutoring:    "education",
  training:    "education",
  veterinary:  "clinics",
  vet:         "clinics",
};

/**
 * Returns the wallpaper class for a category slug.
 * Unknown or missing slugs fall back to the neutral ground.
 */
export function coverClassFor(slug?: string | null): string {
  if (!slug) return "cover-default";
  const key = slug.trim().toLowerCase();
  if (KNOWN.has(key)) return `cover-${key}`;
  const alias = ALIASES[key];
  return alias ? `cover-${alias}` : "cover-default";
}
