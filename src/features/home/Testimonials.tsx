"use client";

import Container from "@/components/ui/Container";
import { testimonials } from "@/data/testimonials";
import StarRating from "@/components/shared/StarRating";
import Badge from "@/components/ui/Badge";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Testimonials() {
  const { t, lang } = useLanguage();
  const s = t.testimonials;

  return (
    <section id="testimonials" className="section-padding bg-[var(--color-surface-2)]">
      <Container>
        <div className="text-center max-w-xl mx-auto mb-12">
          <p className="section-eyebrow mb-2">{s.eyebrow}</p>
          <h2 className="section-title mb-4">{s.title}</h2>
          <p className="section-subtitle mx-auto">{s.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {testimonials.map((t) => (
            <div key={t.id} className="card p-6 flex flex-col gap-4">
              <Badge variant={t.type === "business" ? "brand" : "accent"} className="self-start">
                {t.type === "business" ? s.badgeBusiness : s.badgeCustomer}
              </Badge>

              <StarRating rating={t.rating} showCount={false} />

              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed flex-1">
                &ldquo;{lang === "en" ? t.textEn : t.text}&rdquo;
              </p>

              <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border)]">
                <div className="w-10 h-10 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-sm font-bold text-[var(--color-text-secondary)]">
                  {t.avatarInitials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t.authorName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t.businessName ? `${t.businessName} — ` : ""}
                    {lang === "en" ? t.authorRoleEn : t.authorRole}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
