import { db } from "@/lib/db";
import { qualifiesAsVerified } from "@/lib/verification";
import { log } from "@/lib/logger";

/**
 * Recomputes the "موثّق" badge for one business.
 *
 * `isVerified` was previously a column that nothing ever wrote, so the
 * badge was permanently off for every listing — a trust signal that
 * could not be earned. It is now derived from facts, and recomputed
 * whenever one of those facts changes: the owner proved their email,
 * proved the WhatsApp number bookings are sent to, listed at least one
 * service, and filled in enough of the profile to be bookable.
 *
 * Never set directly from a request body. A business must not be able
 * to mark itself verified.
 */
export async function syncVerifiedBadge(businessId: string): Promise<boolean> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      isVerified: true,
      phoneVerifiedAt: true,
      about: true,
      address: true,
      logoImage: true,
      owner: { select: { emailVerified: true } },
      _count: { select: { services: true } },
    },
  });

  if (!business) return false;

  const qualifies = qualifiesAsVerified({
    emailVerified: business.owner.emailVerified !== null,
    phoneVerified: business.phoneVerifiedAt !== null,
    hasServices: business._count.services > 0,
    hasProfile: Boolean(business.about && business.address && business.logoImage),
  });

  if (qualifies !== business.isVerified) {
    await db.business.update({
      where: { id: business.id },
      data: { isVerified: qualifies },
    });
    log.info("verified badge changed", { businessId: business.id, verified: qualifies });
  }

  return qualifies;
}

/**
 * What the dashboard needs to tell an owner why they are not verified
 * yet, and what to do about it.
 */
export interface VerificationChecklist {
  emailVerified: boolean;
  phoneVerified: boolean;
  hasServices: boolean;
  hasProfile: boolean;
  isPublished: boolean;
  isVerified: boolean;
}

export async function getVerificationChecklist(
  businessId: string,
): Promise<VerificationChecklist | null> {
  const business = await db.business.findUnique({
    where: { id: businessId },
    select: {
      isVerified: true,
      isPublished: true,
      phoneVerifiedAt: true,
      about: true,
      address: true,
      logoImage: true,
      owner: { select: { emailVerified: true } },
      _count: { select: { services: true } },
    },
  });

  if (!business) return null;

  return {
    emailVerified: business.owner.emailVerified !== null,
    phoneVerified: business.phoneVerifiedAt !== null,
    hasServices: business._count.services > 0,
    hasProfile: Boolean(business.about && business.address && business.logoImage),
    isPublished: business.isPublished,
    isVerified: business.isVerified,
  };
}
