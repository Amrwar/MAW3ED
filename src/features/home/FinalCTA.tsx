"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FinalCTA() {
  const { t } = useLanguage();
  const c = t.finalCta;

  return (
    <section className="bg-[var(--color-ground)] pb-20 pt-6">
      <div className="container-app">
        <div className="rounded-[var(--radius-2xl)] bg-[var(--color-night)] px-8 py-16 text-center sm:px-14">

          <span className="section-eyebrow text-[var(--color-night-subtle)]">{c.eyebrow}</span>

          <h2 className="mx-auto mt-4 max-w-[20ch] text-[clamp(2rem,4.5vw,2.75rem)] font-light leading-[1.15] tracking-tight text-white">
            {c.title}
            <br />
            {c.titleLine2}
          </h2>

          <p className="mx-auto mt-5 max-w-[46ch] text-base leading-[1.8] text-[var(--color-night-text)]">
            {c.subtitle}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/businesses"
              className="btn btn-pill btn-lg bg-white text-[var(--color-ink)] font-extrabold hover:bg-white/90"
            >
              {c.cta1}
            </Link>
            <Link
              href="/signup?type=business"
              className="btn btn-pill btn-lg border-[var(--color-night-line)] bg-transparent text-white hover:bg-white/10"
            >
              {c.cta2}
            </Link>
          </div>

          <p className="mt-7 text-xs text-[var(--color-night-subtle)]">{c.note}</p>
        </div>
      </div>
    </section>
  );
}
