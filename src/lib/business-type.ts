// ─── Business type definitions ────────────────────────────────
// These mirror the Prisma BusinessType enum.

export type BusinessType = "GENERAL" | "RESTAURANT" | "BARBERSHOP";

export const BUSINESS_TYPE_META: Record<
  BusinessType,
  { ar: string; en: string; descAr: string; descEn: string; emoji: string }
> = {
  GENERAL: {
    ar:     "عام",
    en:     "General",
    descAr: "عيادات، صالونات، جيم، استشارات، وغيرها",
    descEn: "Clinics, salons, gyms, consulting, and more",
    emoji:  "🏢",
  },
  RESTAURANT: {
    ar:     "مطعم",
    en:     "Restaurant",
    descAr: "حجز طاولات وجلسات مع إدارة السعة والمواعيد",
    descEn: "Table-based reservations with capacity and meal-period management",
    emoji:  "🍽️",
  },
  BARBERSHOP: {
    ar:     "حلاقة / صالون",
    en:     "Barbershop / Salon",
    descAr: "مواعيد مرتبطة بالحلاق أو الموظف مع إدارة الفريق",
    descEn: "Staff-based appointments with barber / team management",
    emoji:  "✂️",
  },
};

// ─── Table type labels ────────────────────────────────────────

export const TABLE_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  CORNER:  { ar: "زاوية",       en: "Corner"   },
  MIDDLE:  { ar: "وسط",         en: "Middle"   },
  OUTDOOR: { ar: "خارجي",       en: "Outdoor"  },
  WINDOW:  { ar: "نافذة",       en: "Window"   },
  FAMILY:  { ar: "عائلي",       en: "Family"   },
  PRIVATE: { ar: "خاص / VIP",   en: "Private"  },
  BAR:     { ar: "بار",         en: "Bar"      },
  BOOTH:   { ar: "كابينة",      en: "Booth"    },
};

// ─── Feature flags per type ────────────────────────────────────

export function hasTableManagement(t: BusinessType) {
  return t === "RESTAURANT";
}

export function hasStaffManagement(t: BusinessType) {
  return t === "BARBERSHOP";
}

export function isDurationRequired(t: BusinessType) {
  return t !== "RESTAURANT";
}
