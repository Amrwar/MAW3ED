"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, MapPin, Clock, Star, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { num } from "@/lib/fmt";

/**
 * The hero sells the booking, so the search field and the next free
 * slots are the two things that have to be above the fold. The photo
 * frame carries a real cover image once one is uploaded; until then
 * it falls back to the soft out-of-focus treatment in globals.css.
 */
export default function HeroSection() {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const h = t.hero;

  const [query, setQuery] = useState("");
  const [city, setCity]   = useState("");

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (city) params.set("city", city);
    router.push(`/businesses${params.toString() ? `?${params}` : ""}`);
  }

  const copy = {
    nextSlots:  lang === "ar" ? "أقرب مواعيد متاحة — اليوم" : "Next available today",
    confirm:    lang === "ar" ? "تأكيد الحجز"               : "Confirm booking",
    rating:     lang === "ar" ? "تقييم العملاء"             : "Customer rating",
    coverAlt:   lang === "ar" ? "صورة من داخل صالون"        : "Inside a salon",
    trust:      lang === "ar" ? "نشاط في 18 محافظة"         : "businesses across 18 governorates",
    reviews:    lang === "ar" ? "تقييم"                     : "reviews",
    from:       lang === "ar" ? "من"                        : "from",
  };

  const slots = ["10:30", "11:00", "13:15", "16:00"];

  return (
    <section className="pt-20 bg-[var(--color-ground)]">
      <div className="container-app py-14 lg:py-20">
        <div className="flex flex-wrap items-center gap-14 lg:gap-20">

          {/* ── Copy + search ── */}
          <div className="flex-[1_1_28rem] min-w-0 flex flex-col gap-7">

            <span className="inline-flex self-start items-center gap-2 h-8 px-3.5 rounded-full bg-[var(--color-jade-soft)] text-[var(--color-ok)] text-[0.78125rem] font-bold">
              <Sparkles size={14} strokeWidth={1.8} aria-hidden="true" />
              {h.eyebrow}
            </span>

            <h1 className="display-title">
              {h.title}
              <br />
              <span className="font-extrabold text-[var(--color-jade)]">{h.titleAccent}</span>
            </h1>

            <p className="max-w-[42ch] text-[1.0625rem] leading-[1.75] text-[var(--color-muted)] whitespace-pre-line">
              {h.subtitle}
            </p>

            {/* Search */}
            <form
              onSubmit={onSearch}
              className="mt-1 flex flex-wrap items-center gap-1 max-w-[35rem] rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-2.5 shadow-[var(--shadow-raised)]"
            >
              <div className="flex flex-[1_1_12rem] min-w-0 items-center gap-2.5 px-3.5">
                <Search size={18} strokeWidth={1.8} className="shrink-0 text-[var(--color-subtle)]" aria-hidden="true" />
                <label htmlFor="hero-q" className="sr-only-label">{h.searchPlaceholder}</label>
                <input
                  id="hero-q"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={h.searchPlaceholder}
                  className="w-full min-w-0 border-0 bg-transparent text-[0.9375rem] font-bold text-[var(--color-ink)] outline-none placeholder:font-normal placeholder:text-[var(--color-faint)]"
                />
              </div>

              <span aria-hidden="true" className="hidden sm:block h-7 w-px shrink-0 bg-[var(--color-line)]" />

              <div className="flex flex-[0_1_10rem] min-w-0 items-center gap-2 px-3.5">
                <MapPin size={17} strokeWidth={1.8} className="shrink-0 text-[var(--color-subtle)]" aria-hidden="true" />
                <label htmlFor="hero-city" className="sr-only-label">{h.allCities}</label>
                <input
                  id="hero-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={h.allCities}
                  className="w-full min-w-0 border-0 bg-transparent text-[0.9375rem] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-faint)]"
                />
              </div>

              <button type="submit" className="btn btn-primary shrink-0 grow sm:grow-0">
                {h.searchBtn}
              </button>
            </form>

            {/* Trust row */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center" aria-hidden="true">
                <span className="block h-9 w-9 rounded-full border-2 border-[var(--color-ground)] photo-warm" />
                <span className="-ms-3 block h-9 w-9 rounded-full border-2 border-[var(--color-ground)] photo-cool" />
                <span className="-ms-3 block h-9 w-9 rounded-full border-2 border-[var(--color-ground)] photo-green" />
                <span className="-ms-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--color-ground)] bg-[var(--color-night)] text-[0.65rem] font-bold text-white">
                  <span className="num">+1.2k</span>
                </span>
              </div>
              <p className="text-[0.84375rem] leading-relaxed text-[var(--color-muted)]">
                <strong className="font-bold text-[var(--color-ink)]">
                  <span className="num">{num(1240, lang)}</span> {copy.trust}
                </strong>
                {" · "}
                <span className="num">4.8</span>
                <Star size={13} className="inline-block -mt-0.5 mx-1 fill-[var(--color-star)] text-[var(--color-star)]" aria-hidden="true" />
                {copy.from} <span className="num">{num(31400, lang)}</span> {copy.reviews}
              </p>
            </div>
          </div>

          {/* ── Visual ── */}
          <div className="relative flex-[0_1_30rem] min-w-[18rem] hidden md:block">
            <div
              role="img"
              aria-label={copy.coverAlt}
              className="photo-warm h-[34rem] w-full rounded-[var(--radius-2xl)] shadow-[var(--shadow-float)]"
            />

            {/* Rating pill */}
            <div className="absolute top-7 -start-5 flex items-center gap-2.5 rounded-[var(--radius-md)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-float)]">
              <Star size={16} className="fill-[var(--color-star)] text-[var(--color-star)]" aria-hidden="true" />
              <div>
                <div className="num text-[0.9375rem] font-extrabold leading-tight">4.9</div>
                <div className="text-[0.6875rem] text-[var(--color-subtle)]">{copy.rating}</div>
              </div>
            </div>

            {/* Next-slots card */}
            <div className="absolute bottom-7 -end-7 w-[17.5rem] rounded-[var(--radius-xl)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)]">
              <div className="mb-3.5 flex items-center gap-2.5">
                <Clock size={15} strokeWidth={1.8} className="text-[var(--color-jade)]" aria-hidden="true" />
                <span className="text-[0.78125rem] font-bold text-[var(--color-ink)]">{copy.nextSlots}</span>
              </div>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {slots.map((s, i) => (
                  <span
                    key={s}
                    className={
                      i === 1
                        ? "num rounded-[var(--radius-sm)] bg-[var(--color-jade)] px-3 py-1.5 text-[0.78125rem] font-bold text-white"
                        : "num rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-1.5 text-[0.78125rem] text-[var(--color-muted)]"
                    }
                  >
                    {s}
                  </span>
                ))}
              </div>
              <Link href="/businesses" className="btn btn-night w-full btn-sm">
                {copy.confirm}
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
