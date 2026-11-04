"use client";

import Link from "@/components/shared/LocaleLink";
import { Building2, MapPin } from "lucide-react";
import type { PlaceHit } from "@/lib/discovery/places";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";

const KIND: Record<string, { ar: string; en: string }> = {
  MALL: { ar: "مول", en: "Mall" },
  COMPOUND: { ar: "كمبوند", en: "Compound" },
  BUSINESS_GROUP: { ar: "مجموعة أعمال", en: "Business group" },
  RESTAURANT_GROUP: { ar: "مجموعة مطاعم", en: "Restaurant group" },
  CLINIC_GROUP: { ar: "مجموعة عيادات", en: "Clinic group" },
  FRANCHISE: { ar: "سلسلة", en: "Franchise" },
  COMMERCIAL_BUILDING: { ar: "مبنى تجاري", en: "Commercial building" },
  OFFICE_COMPLEX: { ar: "مجمع مكاتب", en: "Office complex" },
  BUSINESS_PARK: { ar: "بيزنس بارك", en: "Business park" },
  MIXED_USE: { ar: "مشروع متعدد الاستخدامات", en: "Mixed-use destination" },
  COMMUNITY_CENTER: { ar: "مركز خدمات", en: "Community centre" },
  OTHER: { ar: "مكان", en: "Place" },
};

/**
 * Malls, groups and venues whose name matches the search, above the
 * business results. Each links to its public directory, where its
 * businesses are listed. Shown only when something matched.
 */
export default function PlacesBlock({ places }: { places: PlaceHit[] }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  if (places.length === 0) return null;

  return (
    <section aria-labelledby="places-heading" className="mb-6">
      <h2 id="places-heading" className="m-0 mb-3 text-[0.9375rem] font-bold text-[var(--color-ink)]">
        {en ? "Places and groups" : "أماكن ومجموعات"}
      </h2>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {places.map((p) => {
          const name = en && p.nameEn ? p.nameEn : p.nameAr;
          const city = p.city ? (en ? p.city.nameEn : p.city.nameAr) : null;
          const kind = KIND[p.kind] ?? KIND.OTHER;
          const href = p.type === "organization" ? `/groups/${p.slug}` : `/venues/${p.slug}`;
          return (
            <li key={`${p.type}:${p.slug}`}>
              <Link
                href={href}
                className="card flex min-h-[4.5rem] items-center gap-3 p-3 transition-colors hover:border-[var(--color-jade)]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-jade-soft)]">
                  {p.logoImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a small logo from the owner's CDN URL
                    <img src={p.logoImage} alt="" width={44} height={44} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 size={20} className="text-[var(--color-jade)]" aria-hidden />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-ink)]">{name}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-[var(--color-subtle)]">
                    <span>{en ? kind.en : kind.ar}</span>
                    {city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} aria-hidden />
                        {city}
                      </span>
                    )}
                    <span>
                      {en
                        ? `${num(p.businesses, lang)} ${p.businesses === 1 ? "business" : "businesses"}`
                        : `${num(p.businesses, lang)} نشاط`}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
