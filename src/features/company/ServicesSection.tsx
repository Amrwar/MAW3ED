"use client";

import { useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import type { Service } from "@/types/service";
import Button from "@/components/ui/Button";
import { formatDuration, formatPrice } from "@/lib/utils";

interface ServicesSectionProps {
  services: Service[];
  onBook?: (service: Service) => void;
}

export default function ServicesSection({
  services,
  onBook,
}: ServicesSectionProps) {
  const categories = [...new Set(services.map((s) => s.category).filter(Boolean))];
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered =
    activeCategory === "all"
      ? services
      : services.filter((s) => s.category === activeCategory);

  return (
    <div id="services" className="py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-[var(--color-text-primary)]">
          الخدمات
        </h2>
        <span className="text-sm text-[var(--color-text-muted)]">
          {services.length} خدمة
        </span>
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
              activeCategory === "all"
                ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-brand)]"
            }`}
          >
            الكل
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat!)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all ${
                activeCategory === cat
                  ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)]"
                  : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-brand)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Service list */}
      <div className="space-y-3">
        {filtered.map((service) => (
          <div
            key={service.id}
            className="card p-4 flex items-center gap-4 group hover:border-[var(--color-accent)]/50 transition-all"
          >
            {/* Service icon placeholder */}
            <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center text-lg shrink-0">
              🩺
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)] text-sm mb-0.5">
                {service.nameAr}
              </p>
              {service.descriptionAr && (
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">
                  {service.descriptionAr}
                </p>
              )}
              {service.duration > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock size={11} className="text-[var(--color-text-muted)]" />
                  <span className="text-xs text-[var(--color-text-muted)]">
                    {formatDuration(service.duration)}
                  </span>
                </div>
              )}
            </div>

            {/* Price & CTA */}
            <div className="text-end shrink-0">
              <p className="font-black text-[var(--color-text-primary)] text-base">
                {formatPrice(service.price, service.currency)}
              </p>
              <Button
                variant="accent"
                size="sm"
                className="mt-2"
                onClick={() => onBook?.(service)}
              >
                احجز
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
