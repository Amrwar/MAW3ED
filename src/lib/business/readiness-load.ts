import { db } from "@/lib/db";
import { businessAllows } from "@/lib/plans";
import { computeReadiness, type Readiness, type ReadinessFacts } from "./readiness";

/** The facts the checklist is computed from, read in one go. */
export async function loadReadinessFacts(businessId: string): Promise<ReadinessFacts | null> {
  const b = await db.business.findUnique({
    where: { id: businessId },
    select: {
      businessType: true,
      categoryId: true,
      phone: true,
      address: true,
      latitude: true,
      longitude: true,
      logoImage: true,
      about: true,
      phoneVerifiedAt: true,
      depositEnabled: true,
      policiesReviewedAt: true,
      notificationPhone: true,
      isPublished: true,
      plan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      owner: { select: { emailVerified: true } },
      services: { where: { isAvailable: true }, select: { duration: true, price: true } },
      availability: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
      _count: {
        select: {
          staffMembers: { where: { isActive: true } },
          resources: { where: { isActive: true } },
          bookings: { where: { isTest: true } },
        },
      },
    },
  });
  if (!b) return null;

  const emailVerified = b.owner.emailVerified !== null;
  return {
    businessType: b.businessType,
    hasCategory: !!b.categoryId,
    phone: b.phone,
    address: b.address,
    hasLocation: b.latitude !== null && b.longitude !== null,
    logoImage: b.logoImage,
    about: b.about,
    emailVerified,
    phoneVerified: b.phoneVerifiedAt !== null,
    services: b.services.map((s) => ({ duration: s.duration, price: Number(s.price) })),
    hours: b.availability,
    activeStaff: b._count.staffMembers,
    activeResources: b._count.resources,
    depositEnabled: b.depositEnabled,
    depositsAllowed: businessAllows(b, "deposits"),
    policiesReviewed: b.policiesReviewedAt !== null,
    notificationReachable: emailVerified || !!b.notificationPhone?.trim(),
    isPublished: b.isPublished,
    testBookings: b._count.bookings,
  };
}

export async function loadReadiness(businessId: string): Promise<Readiness | null> {
  const facts = await loadReadinessFacts(businessId);
  return facts ? computeReadiness(facts) : null;
}
