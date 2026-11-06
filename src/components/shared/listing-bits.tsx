"use client";

import { Heart } from "lucide-react";
import { countText, type Lang } from "@/lib/i18n";
import type { PublicBusiness } from "@/lib/data";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

/**
 * Small pieces the homepage listing sections share with each other.
 * Each reads only what is on the record, exactly as BusinessCard does:
 * no substituted rating, no "0 EGP", no time that is not really free.
 */

export function businessName(b: PublicBusiness, lang: Lang): string {
  return lang !== "ar" && b.nameEn ? b.nameEn : b.nameAr;
}

export function businessPlace(b: PublicBusiness, lang: Lang): string {
  const ar = lang === "ar";
  return [b.neighborhood && (ar ? b.neighborhood.nameAr : b.neighborhood.nameEn), ar ? b.city.nameAr : b.city.nameEn]
    .filter(Boolean)
    .join(ar ? "، " : ", ");
}

export function dayLabel(
  offset: number,
  lang: Lang,
  c: { today: string; tomorrow: string; inDays: Parameters<typeof countText>[2] },
): string {
  return offset === 0 ? c.today : offset === 1 ? c.tomorrow : countText(lang, offset, c.inDays);
}

/** Saved to this browser, not to an account: the same control as the card's. */
export function SaveButton({
  id,
  labels,
  size = "md",
  className,
}: {
  id: string;
  labels: { save: string; unsave: string };
  size?: "sm" | "md";
  className?: string;
}) {
  const { isFavorite, toggle } = useFavorites();
  const saved = isFavorite(id);
  return (
    <button
      type="button"
      onClick={() => toggle(id)}
      aria-pressed={saved}
      aria-label={saved ? labels.unsave : labels.save}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)]/95 shadow-[var(--shadow-raised)] transition-colors",
        size === "sm" ? "h-9 w-9" : "h-11 w-11",
        saved ? "text-[var(--color-danger)]" : "text-[var(--color-muted)] hover:text-[var(--color-danger)]",
        className,
      )}
    >
      <Heart size={size === "sm" ? 15 : 17} strokeWidth={2} aria-hidden="true" className={saved ? "fill-current" : undefined} />
    </button>
  );
}
