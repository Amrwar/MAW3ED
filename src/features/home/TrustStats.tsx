"use client";

import Container from "@/components/ui/Container";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TrustStats() {
  const { t } = useLanguage();

  return (
    <section className="py-16 bg-[var(--color-surface-2)] border-y border-[var(--color-border)]">
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {t.trustStats.items.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <p className="text-3xl font-black text-[var(--color-text-primary)] mb-1">
                {stat.value}
              </p>
              <p className="font-semibold text-[var(--color-text-primary)] text-sm mb-0.5">
                {stat.label}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {stat.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
