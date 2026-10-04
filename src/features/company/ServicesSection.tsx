"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import type { Service } from "@/types/service";
import { useLanguage } from "@/contexts/LanguageContext";
import { duration as fmtDuration, money, num } from "@/lib/fmt";
import { cn } from "@/lib/utils";

interface Props {
  services: Service[];
  onBook?: (service: Service) => void;
}

export default function ServicesSection({ services, onBook }: Props) {
  const { lang } = useLanguage();
  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))];
  const [activeCategory, setActiveCategory] = useState<string>("all");

  if (services.length === 0) return null;

  const filtered =
    activeCategory === "all"
      ? services
      : services.filter((s) => s.category === activeCategory);

  return (
    <section id="services">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="m-0 text-[1.5rem] font-bold text-[var(--color-ink)]">الخدمات</h2>
        <span className="text-[0.8125rem] text-[var(--color-subtle)]">
          <span className="num">{num(services.length, lang)}</span> خدمات
        </span>
      </div>

      {categories.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            aria-pressed={activeCategory === "all"}
            className={cn("chip", activeCategory === "all" && "chip-active")}
          >
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat!)}
              aria-pressed={activeCategory === cat}
              className={cn("chip", activeCategory === cat && "chip-active")}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {filtered.map((service) => (
          <li
            key={service.id}
            className="flex flex-wrap items-center gap-5 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4"
          >
            <div className="min-w-0 flex-[1_1_15rem]">
              <h3 className="m-0 text-base font-bold text-[var(--color-ink)]">
                {service.nameAr}
              </h3>
              {service.descriptionAr && (
                <p className="mt-1.5 line-clamp-1 text-[0.84375rem] text-[var(--color-subtle)]">
                  {service.descriptionAr}
                </p>
              )}
              {service.duration > 0 && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[0.8125rem] text-[var(--color-subtle)]">
                  <Clock size={13} strokeWidth={1.8} aria-hidden="true" />
                  {fmtDuration(service.duration, lang)}
                </p>
              )}
            </div>

            <span className="num shrink-0 text-[1.125rem] font-extrabold text-[var(--color-ink)]">
              {money(service.price, lang, service.currency)}
            </span>

            <button
              type="button"
              onClick={() => onBook?.(service)}
              className="btn btn-jade-outline btn-sm shrink-0"
            >
              احجز
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
