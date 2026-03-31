"use client";

import { useState } from "react";
import { Search, MapPin, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import { categories } from "@/data/categories";
import CategoryChip from "@/components/shared/CategoryChip";

const heroStats = [
  { value: "٣٠٠+", label: "عمل مسجّل" },
  { value: "١٢,٠٠٠+", label: "حجز ناجح" },
  { value: "٤.٩", label: "متوسط التقييم" },
];

export default function HeroSection() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-white pt-16">
      {/* Background decoration */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none overflow-hidden"
      >
        {/* Gradient blob top right */}
        <div className="absolute -top-40 -end-40 w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-orange-50 via-rose-50 to-transparent opacity-70" />
        {/* Grid dots */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #0A0A0A 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="container-app relative z-10 py-20">
        <div className="max-w-2xl mx-auto text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[var(--color-accent-light)] text-[var(--color-accent)] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            منصة الحجز الأولى في مصر
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 text-[var(--color-text-primary)]">
            احجز موعدك
            <br />
            <span className="gradient-text">في ثوانٍ</span>
          </h1>

          <p className="text-lg md:text-xl text-[var(--color-text-secondary)] mb-10 leading-relaxed">
            منصة موعد تربطك بأفضل العيادات والصالونات والمراكز الصحية.
            <br className="hidden md:block" />
            ابحث، اختار، واحجز — بدون انتظار.
          </p>

          {/* Search bar */}
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[var(--color-border)] p-1.5 flex flex-col sm:flex-row gap-1.5 mb-6">
            {/* Search input */}
            <div className="flex items-center gap-3 flex-1 px-4 py-2">
              <Search size={18} className="text-[var(--color-text-muted)] shrink-0" />
              <input
                type="text"
                placeholder="ابحث عن عيادة، صالون، سبا..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              />
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px bg-[var(--color-border)] my-1" />

            {/* Location */}
            <div className="flex items-center gap-2 px-4 py-2 sm:w-44">
              <MapPin size={16} className="text-[var(--color-text-muted)] shrink-0" />
              <span className="text-sm text-[var(--color-text-muted)]">القاهرة</span>
              <ChevronDown size={14} className="text-[var(--color-text-muted)] me-auto" />
            </div>

            {/* Search button */}
            <Button variant="accent" className="shrink-0 rounded-xl px-6">
              ابحث
            </Button>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.slice(0, 6).map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setActiveCategory(
                    activeCategory === cat.slug ? null : cat.slug
                  )
                }
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all duration-150 ${
                  activeCategory === cat.slug
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)] text-white"
                    : "border-[var(--color-border)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.nameAr}</span>
              </button>
            ))}
          </div>

          {/* Trust stats */}
          <div className="flex items-center justify-center gap-8 md:gap-12">
            {heroStats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl md:text-3xl font-black text-[var(--color-text-primary)]">
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-medium">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        aria-hidden
        className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"
      />
    </section>
  );
}
