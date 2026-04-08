"use client";

import Link from "next/link";
import Container from "@/components/ui/Container";
import { Check, Zap, Star, Crown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const planIcons = [Star, Zap, Crown];
const planStyles = [
  { color: "text-gray-500",  border: "border-[var(--color-border)]",  highlight: false, ctaHref: "/signup",  ctaClass: "btn btn-outline w-full" },
  { color: "text-blue-600",  border: "border-blue-500",               highlight: true,  ctaHref: "/signup",  ctaClass: "btn w-full bg-white text-blue-600 font-bold hover:bg-blue-50" },
  { color: "text-amber-600", border: "border-amber-300",              highlight: false, ctaHref: "/pricing", ctaClass: "btn w-full bg-amber-500 text-white hover:bg-amber-600" },
];

export default function PricingPreview() {
  const { t } = useLanguage();
  const p = t.pricingPreview;

  return (
    <section className="section-padding">
      <Container>
        <div className="text-center max-w-xl mx-auto mb-14">
          <p className="section-eyebrow mb-2">{p.eyebrow}</p>
          <h2 className="section-title mb-4">{p.title}</h2>
          <p className="section-subtitle mx-auto">{p.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {p.plans.map((plan, i) => {
            const style = planStyles[i];
            const Icon  = planIcons[i];
            const isHighlighted = style.highlight;

            return (
              <div
                key={plan.name}
                className={`relative rounded-2xl border-2 ${style.border} overflow-hidden transition-all duration-200 ${
                  isHighlighted
                    ? "bg-blue-600 shadow-xl shadow-blue-100"
                    : "bg-white hover:shadow-md"
                }`}
              >
                {isHighlighted && (
                  <div className="absolute top-0 inset-x-0 bg-blue-700 text-white text-xs font-bold text-center py-1.5">
                    {p.badge}
                  </div>
                )}

                <div className={`p-6 ${isHighlighted ? "pt-10" : ""}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <Icon size={18} className={isHighlighted ? "text-white" : style.color} />
                    <span className={`font-bold text-sm ${isHighlighted ? "text-white" : "text-[var(--color-text-primary)]"}`}>
                      {plan.name}
                    </span>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-black ${isHighlighted ? "text-white" : "text-[var(--color-text-primary)]"}`}>
                        {plan.price}
                      </span>
                      <span className={`text-sm ${isHighlighted ? "text-blue-100" : "text-[var(--color-text-muted)]"}`}>
                        {plan.period}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check size={14} className={`shrink-0 ${isHighlighted ? "text-blue-100" : "text-green-500"}`} />
                        <span className={`text-sm ${isHighlighted ? "text-blue-100" : "text-[var(--color-text-secondary)]"}`}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link href={style.ctaHref} className={style.ctaClass}>
                    {plan.cta}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/pricing"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline underline-offset-4"
          >
            {p.viewAll}
          </Link>
        </div>
      </Container>
    </section>
  );
}
