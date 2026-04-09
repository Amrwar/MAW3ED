"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PageHero from "@/components/shared/PageHero";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FaqPage() {
  const { t, lang } = useLanguage();
  const f = t.faq;

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <PageHero
          badge={f.eyebrow}
          title={f.title}
          subtitle={f.subtitle}
          dir={lang === "ar" ? "rtl" : "ltr"}
        />

        <section className="section-padding">
          <Container>
            <div className="max-w-2xl mx-auto space-y-4">
              {f.items.map((item, i) => (
                <div key={i} className="card p-6">
                  <h3 className="font-bold text-[var(--color-text-primary)] mb-2">{item.q}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-12">
              <p className="text-[var(--color-text-secondary)] mb-4">{f.notFoundTitle}</p>
              <Link href="/contact" className="btn btn-primary">{f.contactBtn}</Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}
