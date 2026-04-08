"use client";

import Container from "@/components/ui/Container";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FinalCTA() {
  const { t } = useLanguage();
  const c = t.finalCta;

  return (
    <section className="section-padding">
      <Container>
        <div className="relative overflow-hidden bg-[var(--color-brand)] rounded-3xl px-8 py-16 text-center">
          <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -end-20 w-64 h-64 rounded-full bg-white/5" />
            <div className="absolute -bottom-20 -start-20 w-80 h-80 rounded-full bg-white/5" />
            <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-white/[0.03]" />
          </div>

          <div className="relative z-10 max-w-xl mx-auto">
            <p className="text-[var(--color-accent)] text-sm font-semibold mb-3">{c.eyebrow}</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
              {c.title}
              <br />
              {c.titleLine2}
            </h2>
            <p className="text-white/60 text-base leading-relaxed mb-8">{c.subtitle}</p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/businesses" className="btn btn-accent btn-lg shadow-lg shadow-[var(--color-accent)]/25">
                {c.cta1}
              </Link>
              <Link
                href="/signup?type=business"
                className="btn btn-outline btn-lg border-white/30 text-white hover:bg-white/10 hover:border-white/50"
              >
                {c.cta2}
              </Link>
            </div>

            <p className="mt-8 text-white/40 text-sm">{c.note}</p>
          </div>
        </div>
      </Container>
    </section>
  );
}
