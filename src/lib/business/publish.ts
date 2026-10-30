import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { loadReadiness } from "./readiness-load";
import type { ReadinessKey } from "./readiness";
import { recordMilestone } from "./lifecycle";

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

async function goLive(businessId: string, ownerId: string): Promise<PublishResult> {
  // Test bookings were the owner trying the flow on a private page.
  // They must not hold real customers' times once the page is public.
  const [, removed] = await db.$transaction([
    db.business.update({ where: { id: businessId }, data: { isPublished: true } }),
    db.booking.deleteMany({ where: { businessId, isTest: true } }),
  ]);
  log.info("business published", { businessId, removedTestBookings: removed.count });
  await recordMilestone("PROFILE_COMPLETED", { userId: ownerId, businessId });
  await recordMilestone("PUBLISHED", { userId: ownerId, businessId });
  return { published: true, removedTestBookings: removed.count };
}
