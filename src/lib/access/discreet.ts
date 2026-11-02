/**
 * Whether a venue's security desk may see which business a visitor is
 * going to (P23-A5).
 *
 * The desk needs the visitor's name, the window and the gates; the
 * business is a convenience. For some businesses it is also a
 * disclosure — a visit to a clinic tells the venue's staff something
 * about the visitor's health. Such a business is "discreet": the desk
 * sees that a visitor is expected, not where.
 *
 * The owner decides (Business.accessDiscreet). Until they do, medical
 * categories are discreet and every other category is not.
 */

/** Categories whose visitors' destination is health information. */
export const DISCREET_CATEGORY_SLUGS: readonly string[] = ["clinics", "dentists", "labs"];

export interface DiscreetInput {
  accessDiscreet: boolean | null;
  category: { slug: string; parent?: { slug: string } | null } | null;
}

/** The default for a category, a subcategory following its parent. */
export function discreetByCategory(category: DiscreetInput["category"]): boolean {
  if (!category) return false;
  return DISCREET_CATEGORY_SLUGS.includes(category.slug) || (!!category.parent && DISCREET_CATEGORY_SLUGS.includes(category.parent.slug));
}

export function isDiscreet(b: DiscreetInput): boolean {
  return b.accessDiscreet ?? discreetByCategory(b.category);
}

/** The Prisma select that isDiscreet reads. */
export const DISCREET_SELECT = {
  accessDiscreet: true,
  category: { select: { slug: true, parent: { select: { slug: true } } } },
} as const;
