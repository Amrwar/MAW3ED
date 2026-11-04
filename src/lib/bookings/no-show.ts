import { db } from "@/lib/db";

/**
 * The no-show policy (docs/architecture/ADVANCED_BOOKING_RULES.md).
 *
 * A business may set a limit: a number that missed `limit` or more
 * appointments within the last `windowDays` days either must pay a
 * deposit to book online, or cannot book online at all and is asked to
 * call. Off by default (noShowLimit null). Only online booking is
 * affected; the business can always book the customer at the desk.
 */
export interface NoShowPolicy {
  noShowLimit: number | null;
  noShowWindowDays: number;
  noShowAction: "REQUIRE_DEPOSIT" | "BLOCK_ONLINE";
}

export type NoShowStanding = { applies: false } | { applies: true; action: NoShowPolicy["noShowAction"]; count: number };

/** Pure: does a count of recent no-shows trigger the policy? */
export function noShowTriggered(policy: NoShowPolicy, count: number): boolean {
  return policy.noShowLimit !== null && policy.noShowLimit > 0 && count >= policy.noShowLimit;
}

export async function noShowStanding(
  businessId: string,
  phoneE164: string | null,
  policy: NoShowPolicy,
  now: Date = new Date(),
): Promise<NoShowStanding> {
  if (!phoneE164 || policy.noShowLimit === null || policy.noShowLimit <= 0) return { applies: false };
  const since = new Date(now.getTime() - Math.max(1, policy.noShowWindowDays) * 86_400_000);
  const count = await db.booking.count({
    where: { businessId, customerPhoneE164: phoneE164, status: "NO_SHOW", isTest: false, startsAt: { gte: since } },
  });
  return noShowTriggered(policy, count) ? { applies: true, action: policy.noShowAction, count } : { applies: false };
}
