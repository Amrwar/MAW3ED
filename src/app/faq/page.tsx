"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FaqPage() {
  const { t } = useLanguage();
  const f = t.faq;

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-14">
          <Container>
            <div className="text-center max-w-xl mx-auto">
              <p className="section-eyebrow mb-2">{f.eyebrow}</p>
              <h1 className="section-title mb-4">{f.title}</h1>
              <p className="section-subtitle mx-auto">{f.subtitle}</p>
            </div>
          </Container>
        </section>

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
