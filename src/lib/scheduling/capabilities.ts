import { db } from "@/lib/db";

/**
 * What a business schedules on.
 *
 * Derived from what it has configured, never from its category. The
 * code this replaces asked `businessType === "RESTAURANT"` to decide
 * whether tables existed and `=== "BARBERSHOP"` to decide whether staff
 * did — so a clinic could not have treatment rooms, a gym could not
 * have equipment, and a salon that also took table bookings was
 * impossible to express.
 *
 * A booking may hold any combination of staff, branch and resource. A
 * dimension is offered when the business has something to offer in it,
 * and ignored when it does not. That is the whole rule.
 */

export interface SchedulingCapabilities {
  /** At least one active staff member. */
  staff: boolean;
  /** At least one active resource — room, chair, table, equipment. */
  resources: boolean;
  /** More than one branch; a single location needs no choosing. */
  branches: boolean;
  /**
   * Party size is asked for when a resource counts seats. It follows
   * the resource having a capacity, not the business being a restaurant.
   */
  partySize: boolean;
  /** Counts, for the dashboard to show without a second query. */
  counts: { staff: number; resources: number; branches: number; services: number };
  /**
   * The dominant resource kind, which only decides what the UI calls
   * them — "الطاولات" or "الغرف". Never affects scheduling.
   */
  resourceKind: "TABLE" | "ROOM" | "CHAIR" | "EQUIPMENT" | "OTHER" | null;
}

export const NO_CAPABILITIES: SchedulingCapabilities = {
  staff: false,
  resources: false,
  branches: false,
  partySize: false,
  counts: { staff: 0, resources: 0, branches: 0, services: 0 },
  resourceKind: null,
};

export async function getCapabilities(businessId: string): Promise<SchedulingCapabilities> {
  const [staff, resources, branches, services, kinds, withCapacity] = await Promise.all([
    db.staffMember.count({ where: { businessId, isActive: true } }),
    db.resource.count({ where: { businessId, isActive: true } }),
    db.branch.count({ where: { businessId, isActive: true } }),
    db.service.count({ where: { businessId, isAvailable: true } }),
    db.resource.groupBy({
      by: ["kind"],
      where: { businessId, isActive: true },
      _count: { _all: true },
      orderBy: { _count: { kind: "desc" } },
      take: 1,
    }),
    db.resource.count({ where: { businessId, isActive: true, capacity: { not: null } } }),
  ]);

  return {
    staff: staff > 0,
    resources: resources > 0,
    branches: branches > 1,
    partySize: withCapacity > 0,
    counts: { staff, resources, branches, services },
    resourceKind: kinds[0]?.kind ?? null,
  };
}

/* ─── Labels ─────────────────────────────────────────────── */

/**
 * What to call a resource on screen.
 *
 * The only thing the kind is used for. Scheduling treats every kind
 * identically — one booking at a time — which is the point of having
 * one model.
 */
export const RESOURCE_KIND_LABELS: Record<
  NonNullable<SchedulingCapabilities["resourceKind"]>,
  { ar: string; arOne: string; en: string; enOne: string }
> = {
  TABLE: { ar: "الطاولات", arOne: "طاولة", en: "Tables", enOne: "Table" },
  ROOM: { ar: "الغرف", arOne: "غرفة", en: "Rooms", enOne: "Room" },
  CHAIR: { ar: "الكراسي", arOne: "كرسي", en: "Chairs", enOne: "Chair" },
  EQUIPMENT: { ar: "الأجهزة", arOne: "جهاز", en: "Equipment", enOne: "Equipment" },
  OTHER: { ar: "الموارد", arOne: "مورد", en: "Resources", enOne: "Resource" },
};

export function resourceLabel(
  kind: SchedulingCapabilities["resourceKind"],
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
