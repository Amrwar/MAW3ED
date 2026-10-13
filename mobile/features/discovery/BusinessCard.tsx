import type { ReactNode } from "react";
import { BusinessCard as Card, useLocale } from "@/design";

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
  open?: { isOpen: boolean } | null;
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
}: {
  business: BusinessCardData;
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
      openNow={business.open ? business.open.isOpen : null}
      onPress={onPress}
      trailing={trailing}
    />
  );
}
