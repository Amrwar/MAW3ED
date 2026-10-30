import { db } from "@/lib/db";

/**
 * Whether a venue has stopped online bookings at this business on a day.
 *
 * A venue notice of kind CLOSED or BOOKINGS_PAUSED covering the date
 * stops new online bookings at the businesses it lists — the venue is
 * shut, so a customer must not be able to book a time there. Only for
 * an APPROVED listing at an ACTIVE venue; a business outside any venue,
 * or only asking to join one, is never affected.
 *
 * Which bookings: a listing of the whole business pauses all of them; a
 * listing of one branch pauses that branch — and, for a business with a
 * single location, its bookings that carry no branch (the widget only
 * asks for a branch when there are several).
 *
 * Read by the slot loader (lib/bookings/schedule.ts), which every
 * online booking path goes through, so the server enforces it. Owners
 * adding a booking by hand are not stopped: the existing owner override.
 * ACCESS_SUSPENDED and SPECIAL_HOURS stay informational.
 */

export const PAUSING_KINDS = ["CLOSED", "BOOKINGS_PAUSED"] as const;

/** Pure: does any paused listing cover this booking's branch? */
export function pauseApplies(
  pausedListings: { branchId: string | null }[],
  branchId: string | null,
  activeBranchCount: number,
): boolean {
  return pausedListings.some(
    (m) =>
      m.branchId === null ||
      (branchId !== null && m.branchId === branchId) ||
      (branchId === null && activeBranchCount <= 1),
  );
}

export async function venuePauses(businessId: string, branchId: string | null, date: string): Promise<boolean> {
  const day = new Date(`${date}T00:00:00Z`);
  // Starts from the business's own approved listings — none, for almost
  // every business, so this is one indexed lookup that returns nothing.
  const listings = await db.venueMembership.findMany({
    where: { businessId, status: "APPROVED", venue: { status: "ACTIVE" } },
    select: {
      branchId: true,
      venue: {
        select: {
          exceptions: {
            where: { kind: { in: [...PAUSING_KINDS] }, startsOn: { lte: day }, endsOn: { gte: day } },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  const paused = listings.filter((l) => l.venue.exceptions.length > 0);
  if (paused.length === 0) return false;
  const needsCount = branchId === null && paused.every((l) => l.branchId !== null);
  const activeBranchCount = needsCount ? await db.branch.count({ where: { businessId, isActive: true } }) : 0;
  return pauseApplies(paused, branchId, activeBranchCount);
}
