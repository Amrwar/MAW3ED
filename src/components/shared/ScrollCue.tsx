"use client";

import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * The arrow at the foot of a full-screen hero.
 *
 * With the hero filling the first screen nothing below it shows, so
 * this is the sign that the page goes on. It scrolls to just past the
 * hero, less the fixed header, so the next section starts under the
 * bar rather than behind it.
 */
export default function ScrollCue() {
  const { lang } = useLanguage();

  function next(e: React.MouseEvent<HTMLButtonElement>) {
    const hero = e.currentTarget.closest("section");
    if (!hero) return;
    // The bar's own height (h-20), not the <header>'s, which grows
    // when the phone menu is open.
    const header = 80;
    const top = hero.getBoundingClientRect().bottom + window.scrollY - header;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }

  return (
    <button
      type="button"
      onClick={next}
      aria-label={lang === "ar" ? "انزل لباقي الصفحة" : "Scroll to the rest of the page"}
      className="absolute bottom-5 left-1/2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-[var(--color-jade-line)] bg-[var(--color-surface)] text-[var(--color-jade)] shadow-sm transition-colors hover:bg-[var(--color-jade-tint)] motion-safe:animate-bounce"
    >
      <ChevronDown size={20} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
