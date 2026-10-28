"use client";

import type { ReactNode } from "react";
import Link from "@/components/shared/LocaleLink";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Lang } from "@/lib/i18n";

type Both<V> = { ar: V; en: V };

/**
 * A public text page — privacy, account deletion — in both languages.
 *
 * Each language has its own address, /privacy and /en/privacy, so either
 * can be pasted into a store form. The stores' existing ?lang=en links
 * are sent to the right one by the proxy (lib/locale-routing), and the
 * link to the other language uses the same parameter, which also saves
 * the choice.
 *
 * The body carries its own dir, so English text inside an Arabic
 * navbar still reads left to right, and the other way round.
 */
export default function LegalPage({
  path,
  title,
  updated,
  body,
}: {
  path: string;
  title: Both<string>;
  updated: Both<string>;
  body: Both<ReactNode>;
}) {
  const { lang } = useLanguage();
  const other: Lang = lang === "ar" ? "en" : "ar";

  return (
    <>
      <Navbar />
      <main id="main" className="pt-24 pb-16">
        <article
          lang={lang}
          dir={lang === "ar" ? "rtl" : "ltr"}
          className="container-app max-w-3xl text-start"
        >
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <h1 className="text-3xl font-extrabold text-[var(--color-text-primary)]">
              {title[lang]}
            </h1>
            {/* A plain link: a full load, so the whole page, header
                included, comes back in the other language. */}
            <a
              href={`${path}?lang=${other}`}
              lang={other}
              className="inline-flex min-h-11 items-center text-sm text-[var(--color-jade)] hover:underline"
            >
              {other === "en" ? "English" : "العربية"}
            </a>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mb-10">{updated[lang]}</p>

          <div className="legal-body space-y-8 text-[var(--color-text-secondary)] leading-relaxed [overflow-wrap:anywhere]">
            {body[lang]}
          </div>

          <div className="mt-10 pt-6 border-t border-[var(--color-line)]">
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-[var(--color-jade)] hover:underline">
              {lang === "ar" ? "← العودة للرئيسية" : "← Back to home"}
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}

/** Section heading and body, in the existing legal pages' style. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/** A plain bulleted list that indents on the reading side in either direction. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 ps-5">{children}</ul>;
}
