import { db } from "@/lib/db";
import type { ResourceKind } from "./resource-labels";

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
  resourceKind: ResourceKind | null;
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
 * Re-exported so existing callers keep working. They live in
 * resource-labels.ts because client components need them and this
 * module imports Prisma.
 */
export {
  RESOURCE_KIND_LABELS,
  resourceLabel,
  providerLabel,
  chooseResourceLabel,
} from "./resource-labels";
