"use client";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PageHero from "@/components/shared/PageHero";
import Link from "@/components/shared/LocaleLink";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FaqPage() {
  const { t, lang } = useLanguage();
  const f = t.faq;

  return (
    <>
      <Navbar />
      <main id="main" className="min-h-screen">
        <PageHero
          badge={f.eyebrow}
          title={f.title}
          subtitle={f.subtitle}
          dir={lang === "ar" ? "rtl" : "ltr"}
        />

        <section className="section-padding">
          <Container>
            {/* General first, then by who is asking: a customer looking
                for the cancellation rule should not read past questions
                about plans to find it. */}
            <div className="max-w-2xl mx-auto space-y-12">
              {[
                { id: "general",   title: null,              items: f.items },
                { id: "customers", title: f.customerTitle,   items: f.customerItems },
                { id: "business",  title: f.businessTitle,   items: f.businessItems },
              ].map((group) => (
                <section key={group.id} id={group.id} aria-labelledby={group.title ? `${group.id}-title` : undefined}>
                  {group.title && (
                    <h2 id={`${group.id}-title`} className="mb-4 text-lg font-bold text-[var(--color-ink)]">
                      {group.title}
                    </h2>
                  )}
                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <div key={item.q} className="card p-6">
                        <h3 className="font-bold text-[var(--color-text-primary)] mb-2">{item.q}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.a}</p>
                      </div>
                    ))}
                  </div>
                </section>
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
