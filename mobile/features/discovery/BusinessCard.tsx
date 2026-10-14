import type { ReactNode } from "react";
import { BusinessCard as Card, useLocale } from "@/design";
import { time } from "@/lib/format";
import type { NextSlot, OpenState } from "@/types/api";
import { count } from "@/lib/plural";

export interface BusinessCardData {
  slug: string;
  nameAr: string;
  nameEn?: string | null;
  logoImage: string | null;
  coverImage: string | null;
  isVerified: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  category: { nameAr: string; nameEn?: string };
  city: { nameAr: string; nameEn?: string };
  minPrice?: number | null;
  currency?: string;
  open?: OpenState | null;
  nextSlot?: NextSlot | null;
}

/** "Next free today 9:00" — from the server's own search, never estimated here. */
export function nextFreeLabel(slot: NextSlot | null | undefined, lang: "ar" | "en"): string | null {
  if (!slot) return null;
  const at = time(slot.time, lang);
  if (lang === "en") {
    const day = slot.dayOffset === 0 ? "today" : slot.dayOffset === 1 ? "tomorrow" : `in ${count(slot.dayOffset, "day", "en")}`;
    return `Next free ${day} ${at}`;
  }
  const day = slot.dayOffset === 0 ? "النهارده" : slot.dayOffset === 1 ? "بكرة" : `بعد ${count(slot.dayOffset, "day", "ar")}`;
  return `أقرب ميعاد ${day} ${at}`;
}

/**
 * A business from the API, drawn by the design system's BusinessCard.
 * Picks the reader's language where the business gave one, and leaves
 * out what is missing rather than zeroing it (no rating is "New", no
 * price is no price) — the design system enforces the rest.
 */
export function BusinessCard({
  business,
  onPress,
  trailing,
  variant = "row",
  distance,
}: {
  business: BusinessCardData;
  /** Already formatted, e.g. "2.4 km" — nearby results only. */
  distance?: string | null;
  onPress?: () => void;
  trailing?: ReactNode;
  variant?: "row" | "feature";
}) {
  const { lang } = useLocale();
  const en = lang === "en";

  return (
    <Card
      variant={variant}
      name={(en && business.nameEn) || business.nameAr}
      category={(en && business.category.nameEn) || business.category.nameAr}
      area={(en && business.city.nameEn) || business.city.nameAr}
      imageUri={variant === "feature" ? (business.coverImage ?? business.logoImage) : (business.logoImage ?? business.coverImage)}
      verified={business.isVerified}
      rating={business.ratingAvg}
      ratingCount={business.ratingCount}
      fromPrice={business.minPrice ?? null}
      currency={business.currency}
      // "unknown" (no hours set) says nothing rather than guessing.
      openNow={business.open?.state === "open" ? true : business.open?.state === "closed" ? false : null}
      nextFree={nextFreeLabel(business.nextSlot, lang)}
      distance={distance}
      onPress={onPress}
      trailing={trailing}
      testID="business-card"
    />
  );
}
