import type { LifecycleEventKind } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Onboarding milestones, each recorded once per account.
 *
 * These are operational facts about a business's own use of the
 * product — it registered, it published, it took its first booking —
 * kept to measure whether onboarding works. They name the account and
 * the business and nothing about any visitor or customer; there is no
 * cookie, no third party and no identifier beyond our own row ids. The
 * privacy policy draft (docs/legal/PRIVACY_POLICY_DRAFT.md) lists them.
 *
 * Recording is best-effort and never throws: a milestone must never
 * fail the action it marks. The unique (userId, kind) index makes a
 * repeat a no-op, so callers do not check first.
 */
export async function recordMilestone(
  kind: LifecycleEventKind,
  who: { userId: string; businessId?: string | null },
  at: Date = new Date(),
): Promise<void> {
  try {
    await db.lifecycleEvent.createMany({
      data: [{ userId: who.userId, businessId: who.businessId ?? null, kind, at }],
      skipDuplicates: true,
    });
  } catch (e) {
    log.error("[lifecycle] could not record milestone", e, { kind });
  }
}

/** The same, for a business: the owner is the account the milestone belongs to. */
export async function recordBusinessMilestone(kind: LifecycleEventKind, businessId: string, at?: Date): Promise<void> {
  const b = await db.business
    .findUnique({ where: { id: businessId }, select: { ownerId: true } })
    .catch(() => null);
  if (b) await recordMilestone(kind, { userId: b.ownerId, businessId }, at);
}

/** The order the funnel reads in. */
export const FUNNEL: LifecycleEventKind[] = [
  "ONBOARDING_STARTED",
  "BUSINESS_REGISTERED",
  "PROFILE_COMPLETED",
  "PUBLISHED",
  "FIRST_BOOKING",
  "FIRST_COMPLETED_BOOKING",
  "FIRST_PAID_SUBSCRIPTION",
];
