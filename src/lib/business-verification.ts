import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Verification, as four separate facts that are never collapsed into
 * one word.
 *
 *   email      the owner opened a link sent to the account's address
 *   phone      the owner typed a code sent to the business's WhatsApp
 *   identity   a Maw3ed administrator checked, from evidence, that this
 *              person runs this business (identityVerifiedAt)
 *   venue      the business is confirmed as a tenant of a venue (a mall,
 *              a clinic building) — not modelled yet; no venue exists in
 *              the data, and nothing claims it
 *
 * The public "موثّق" badge (Business.isVerified) means identity and only
 * identity. It used to be awarded automatically for a confirmed email
 * and phone and a filled-in page, which a customer reads as "Maw3ed
 * checked this business" when all that was checked was that two
 * messages reached somebody (prisma/migrations/phase21_saas.sql).
 * Contact checks now feed the readiness checklist instead.
 */

export interface VerificationStates {
  email: boolean;
  phone: boolean;
  identity: { verified: boolean; at: string | null };
  /** Always "not-applicable" until venues exist. */
  venue: "not-applicable";
}

/**
 * Keeps the badge in step with identity verification. Called after any
 * change that could matter; it can only ever turn the badge OFF for a
 * business that has not been identity-verified, never award it.
 */
export async function syncVerifiedBadge(businessId: string): Promise<boolean> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true, isVerified: true, identityVerifiedAt: true },
  });
  if (!business) return false;
  const verified = business.identityVerifiedAt !== null;
  if (verified !== business.isVerified) {
    await db.business.update({ where: { id: business.id }, data: { isVerified: verified } });
    log.info("verified badge corrected to follow identity verification", { businessId, verified });
  }
  return verified;
}

export async function getVerificationStates(businessId: string): Promise<VerificationStates | null> {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: { phoneVerifiedAt: true, identityVerifiedAt: true, owner: { select: { emailVerified: true } } },
  });
  if (!b) return null;
  return {
    email: b.owner.emailVerified !== null,
    phone: b.phoneVerifiedAt !== null,
    identity: { verified: b.identityVerifiedAt !== null, at: b.identityVerifiedAt?.toISOString() ?? null },
    venue: "not-applicable",
  };
}
