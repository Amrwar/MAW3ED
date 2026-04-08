"use client";

import Container from "@/components/ui/Container";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function WhyJoin() {
  const { t } = useLanguage();
  const w = t.whyJoin;

  return (
    <section className="section-padding bg-[var(--color-surface-2)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Text */}
          <div>
            <p className="section-eyebrow mb-2">{w.eyebrow}</p>
            <h2 className="section-title mb-4">
              {w.title}
              <br />
              <span className="gradient-text">{w.titleLine2}</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] text-base leading-relaxed mb-8">
              {w.subtitle}
            </p>

            <ul className="space-y-2.5 mb-8">
              {w.bullets.map((b) => (
                <li key={b} className="flex items-center gap-2.5">
                  <CheckCircle size={17} className="text-green-500 shrink-0" />
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{b}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/signup?type=business" className="btn btn-primary btn-lg">
                {w.cta1}
              </Link>
              <Link href="/for-business" className="btn btn-outline btn-lg">
                {w.cta2}
              </Link>
            </div>
          </div>

          {/* Benefit cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {w.benefits.map((b) => (
              <div
                key={b.title}
                className="card p-5 hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200"
              >
                <div className="text-2xl mb-3">{b.icon}</div>
                <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1.5">{b.title}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
