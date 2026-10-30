/**
 * The words an organization page is indexed under, in both languages.
 * Pure, tested without rendering. An organization with nobody listed
 * still has a page but is not offered to search engines.
 */

const KIND: Record<string, [string, string]> = {
  MALL: ["مول", "mall"],
  COMPOUND: ["كمبوند", "compound"],
  BUSINESS_GROUP: ["مجموعة أعمال", "business group"],
  FRANCHISE: ["فرنشايز", "franchise"],
  COMMERCIAL_BUILDING: ["مبنى تجاري", "commercial building"],
  OTHER: ["جهة", "organization"],
};

export function orgKindLabel(kind: string, lang: "ar" | "en"): string {
  const [ar, en] = KIND[kind] ?? KIND.OTHER;
  return lang === "en" ? en : ar;
}

export function orgSeo(
  o: {
    slug: string;
    kind: string;
    nameAr: string;
    nameEn: string | null;
    city?: { nameAr: string; nameEn: string } | null;
    directory: unknown[];
  },
  lang: "ar" | "en",
): { title: string; description: string; path: string; index: boolean } {
  const n = o.directory.length;
  const [kAr, kEn] = KIND[o.kind] ?? KIND.OTHER;
  const path = `/groups/${o.slug}`;
  if (lang === "en") {
    const name = o.nameEn || o.nameAr;
    const where = o.city ? ` in ${o.city.nameEn || o.city.nameAr}` : "";
    return {
      title: `${name} — book its places online`,
      description:
        n > 0
          ? `${n} place${n === 1 ? "" : "s"} of ${name}, a ${kEn}${where}, take online bookings on Maw3ed. Browse, compare and book in seconds.`
          : `${name}, a ${kEn}${where}, on Maw3ed.`,
      path,
      index: n > 0,
    };
  }
  const where = o.city ? ` في ${o.city.nameAr}` : "";
  return {
    title: `${o.nameAr} — احجز في أماكنها أونلاين`,
    description:
      n > 0
        ? `${n} مكان تابع لـ${o.nameAr} (${kAr}${where}) بيستقبلوا حجوزات أونلاين على موعد. اتفرج وقارن واحجز في ثوانٍ.`
        : `${o.nameAr}، ${kAr}${where}، على موعد.`,
    path,
    index: n > 0,
  };
}
