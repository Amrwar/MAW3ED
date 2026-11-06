"use client";

import type { Business } from "@/types/business";
import { useLanguage } from "@/contexts/LanguageContext";
import { hasArabic } from "@/lib/lang";

export default function AboutSection({ business }: { business: Business }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  // English pages read the machine English of Arabic-only text
  // (lib/translate), and say so.
  // On an English page: the about in English (translated, or written
  // so), else the tagline in English, and Arabic only when there is no
  // English at all.
  const englishAbout = business.aboutEn || (business.about && !hasArabic(business.about) ? business.about : undefined);
  const text = en
    ? englishAbout || business.taglineEn || business.about || business.taglineAr
    : business.about || business.taglineAr;
  if (!text) return null;
  const translated = en && (text === business.aboutEn || text === business.taglineEn);

  return (
    <section id="about">
      <h2 className="mb-4 text-[1.5rem] font-bold text-[var(--color-ink)]">
        {lang === "en" ? `About ${business.nameEn || business.nameAr}` : `عن ${business.nameAr}`}
      </h2>

      <p className="m-0 max-w-[62ch] text-[0.96875rem] leading-[1.95] text-[var(--color-muted)]">
        {text}
      </p>
      {translated && (
        <p className="m-0 mt-2 text-[0.75rem] text-[var(--color-faint)]">Translated automatically from Arabic</p>
      )}

      {business.tags && business.tags.length > 0 && (
        <ul className="mt-6 flex flex-wrap gap-2.5">
          {business.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 text-[0.8125rem] text-[var(--color-ink-2)]"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
