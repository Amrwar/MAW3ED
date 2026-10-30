import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { loadReadiness } from "./readiness-load";
import type { ReadinessKey } from "./readiness";
import { recordMilestone } from "./lifecycle";
import { recomputeBusinessRating } from "@/lib/reviews";

/**
 * Putting a business in front of the public, and taking it down.
 *
 * Publishing is the owner's decision (publishRequestedAt) AND the
 * readiness checklist's (every required item). Either alone is not
 * enough: an owner cannot publish an empty listing, and a complete
 * listing is not published behind the owner's back. A business an
 * administrator suspended or rejected is never published from here.
 *
 * When the only thing missing is the email confirmation, the request
 * stays recorded and the confirmation link completes it
 * (afterEmailVerified below) — the order most owners actually do it in.
 */

export type PublishResult =
  | { published: true; removedTestBookings: number }
  | { published: false; reason: "missing"; missing: ReadinessKey[]; waitingForEmail: boolean }
  | { published: false; reason: "blocked"; status: string }
  | { published: false; reason: "not-found" };

const BLOCKED = new Set(["SUSPENDED", "REJECTED"]);

export async function requestPublish(businessId: string): Promise<PublishResult> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, ownerId: true, status: true, isPublished: true },
  });
  if (!business) return { published: false, reason: "not-found" };
  if (BLOCKED.has(business.status)) return { published: false, reason: "blocked", status: business.status };

  await db.business.update({ where: { id: businessId }, data: { publishRequestedAt: new Date() } });

  const readiness = await loadReadiness(businessId);
  if (!readiness) return { published: false, reason: "not-found" };
  if (!readiness.canPublish) {
    return {
      published: false,
      reason: "missing",
      missing: readiness.missing,
      waitingForEmail: readiness.missing.length === 1 && readiness.missing[0] === "email",
    };
  }
  return goLive(businessId, business.ownerId);
}

/** Takes the listing down and forgets the request, so nothing republishes it. */
export async function unpublish(businessId: string): Promise<void> {
  await db.business.update({
    where: { id: businessId },
    data: { isPublished: false, publishRequestedAt: null },
  });
}

/**
 * The owner just confirmed their email. A publish that was waiting on
 * it goes ahead now, if nothing else is missing; a business nobody asked
 * to publish stays as it is.
 */
export async function afterEmailVerified(ownerId: string): Promise<boolean> {
  const business = await db.business.findUnique({
    where: { ownerId },
    select: { id: true, status: true, isPublished: true, publishRequestedAt: true },
  });
  if (!business || business.isPublished || !business.publishRequestedAt) return false;
  if (BLOCKED.has(business.status)) return false;
  const readiness = await loadReadiness(business.id);
  if (!readiness?.canPublish) return false;
  const r = await goLive(business.id, ownerId);
  return r.published;
}

class Blocked extends Error {
  constructor(readonly status: string) {
    super("blocked");
  }
}

async function goLive(businessId: string, ownerId: string): Promise<PublishResult> {
  // Test bookings were the owner trying the flow on a private page.
  // They must not hold real customers' times once the page is public.
  //
  // The business row is locked first. A test booking being made right
  // now holds a share lock on it (lib/bookings/create.ts), so it either
  // commits before this and is deleted here, or waits and then finds the
  // page public and stops. The status is read under the same lock, so a
  // suspension that landed after requestPublish looked is still obeyed.
  let removed: number;
  try {
    removed = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status::text AS status FROM "Business" WHERE id = ${businessId} FOR UPDATE`;
      const status = rows[0]?.status;
      if (!status || BLOCKED.has(status)) throw new Blocked(status ?? "missing");
      await tx.business.update({ where: { id: businessId }, data: { isPublished: true } });
      return (await tx.booking.deleteMany({ where: { businessId, isTest: true } })).count;
    });
  } catch (e) {
    if (e instanceof Blocked) return { published: false, reason: "blocked", status: e.status };
    throw e;
  }
  log.info("business published", { businessId, removedTestBookings: removed });
  // A test booking cannot be reviewed, but a rating from one made before
  // that rule would have gone with the booking; the stored average must
  // not keep it.
  if (removed > 0) await recomputeBusinessRating(businessId).catch((e) => log.error("[publish] rating recompute", e));
  await recordMilestone("PROFILE_COMPLETED", { userId: ownerId, businessId });
  await recordMilestone("PUBLISHED", { userId: ownerId, businessId });
  return { published: true, removedTestBookings: removed };
}
