/**
 * The words a venue page is indexed under, in both languages. Pure, so
 * the metadata is tested without rendering a page.
 *
 * A venue with nobody listed yet still has a page — people search for
 * the place itself — but it is not offered to search engines until it
 * lists somebody: a directory with nothing in it is not an answer.
 */

const KIND: Record<string, [string, string]> = {
  MALL: ["مول", "mall"],
  OFFICE_COMPLEX: ["مجمع إداري", "office complex"],
  BUSINESS_PARK: ["بيزنس بارك", "business park"],
  MIXED_USE: ["مشروع متعدد الاستخدامات", "mixed-use development"],
  COMMUNITY_CENTER: ["مركز خدمات", "community centre"],
  OTHER: ["مكان", "destination"],
};

export function venueSeo(
  v: { slug: string; kind: string; nameAr: string; nameEn: string | null; city: { nameAr: string; nameEn: string }; directory: unknown[] },
  lang: "ar" | "en",
): { title: string; description: string; path: string; index: boolean } {
  const n = v.directory.length;
  const [kAr, kEn] = KIND[v.kind] ?? KIND.OTHER;
  const path = `/venues/${v.slug}`;
  if (lang === "en") {
    const name = v.nameEn || v.nameAr;
    const city = v.city.nameEn || v.city.nameAr;
    return {
      title: `${name} — book restaurants, clinics and salons`,
      description:
        n > 0
          ? `${n} place${n === 1 ? "" : "s"} inside ${name}, a ${kEn} in ${city}, take online bookings on Maw3ed. Floors, opening hours, directions and visitor information.`
          : `${name}, a ${kEn} in ${city}: opening hours, directions and visitor information.`,
      path,
      index: n > 0,
    };
  }
  return {
    title: `${v.nameAr} — احجز في المطاعم والعيادات والصالونات`,
    description:
      n > 0
        ? `${n} مكان جوه ${v.nameAr} (${kAr} في ${v.city.nameAr}) بيستقبلوا حجوزات أونلاين على موعد. الأدوار ومواعيد الفتح والاتجاهات ومعلومات الزوار.`
        : `${v.nameAr}، ${kAr} في ${v.city.nameAr}: مواعيد الفتح والاتجاهات ومعلومات الزوار.`,
    path,
    index: n > 0,
  };
}

export function kindLabel(kind: string, lang: "ar" | "en"): string {
  const [ar, en] = KIND[kind] ?? KIND.OTHER;
  return lang === "en" ? en : ar;
}
