/**
 * What to call a resource on screen.
 *
 * Separate from capabilities.ts, which reaches for the database: the
 * booking widget and the resources screen are client components, and
 * importing a label from a module that imports Prisma drags the client
 * into the server's dependencies.
 *
 * The kind is only ever a name. Scheduling treats every kind
 * identically — one booking at a time — which is the point of having
 * one model instead of a table model and a room model and a chair
 * model.
 */

export type ResourceKind = "TABLE" | "ROOM" | "CHAIR" | "EQUIPMENT" | "OTHER";

export const RESOURCE_KIND_LABELS: Record<
  ResourceKind,
  { ar: string; arOne: string; en: string; enOne: string }
> = {
  TABLE: { ar: "الطاولات", arOne: "طاولة", en: "Tables", enOne: "Table" },
  ROOM: { ar: "الغرف", arOne: "غرفة", en: "Rooms", enOne: "Room" },
  CHAIR: { ar: "الكراسي", arOne: "كرسي", en: "Chairs", enOne: "Chair" },
  EQUIPMENT: { ar: "الأجهزة", arOne: "جهاز", en: "Equipment", enOne: "Equipment" },
  OTHER: { ar: "الموارد", arOne: "مورد", en: "Resources", enOne: "Resource" },
};

export function resourceLabel(
  kind: ResourceKind | null,
  lang: "ar" | "en",
  one = false,
): string {
  const entry = RESOURCE_KIND_LABELS[kind ?? "OTHER"];
  if (lang === "ar") return one ? entry.arOne : entry.ar;
  return one ? entry.enOne : entry.en;
}

/** What a business calls the person performing a service. */
export function providerLabel(lang: "ar" | "en"): string {
  return lang === "ar" ? "مقدّم الخدمة" : "Provider";
}

/**
 * "اختر طاولة" / "Choose a room" — the heading of the resource step.
 */
export function chooseResourceLabel(kind: ResourceKind | null, lang: "ar" | "en"): string {
  const one = resourceLabel(kind, lang, true);
  return lang === "ar" ? `اختر ${one}` : `Choose a ${one.toLowerCase()}`;
}
