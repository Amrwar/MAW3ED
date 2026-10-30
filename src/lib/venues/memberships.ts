import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Tenancy: a business asking to be listed in a venue, and the venue
 * deciding.
 *
 * The business side can only ask and withdraw, for its own business and
 * its own branches. The venue side can only decide, for its own venue,
 * and can place the business on one of its own zones. Neither side can
 * touch the other's records: a membership is the only thing they share.
 */

export type MembershipError =
  | "venue-not-found"
  | "venue-not-accepting"
  | "branch-not-yours"
  | "already-live"
  | "not-found"
  | "invalid-transition"
  | "zone-not-in-venue"
  | "pick-a-branch"
  | "overlaps-existing"
  | "recently-rejected";

export class MembershipFailure extends Error {
  constructor(readonly code: MembershipError) {
    super(code);
  }
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** The owner asks for their business (or one branch of it) to be listed. */
export async function requestMembership(input: {
  businessId: string;
  userId: string;
  venueId: string;
  branchId: string | null;
  unit: string | null;
}) {
  const venue = await db.venue.findUnique({ where: { id: input.venueId }, select: { status: true } });
  if (!venue) throw new MembershipFailure("venue-not-found");
  // Only an ACTIVE venue — one the platform has accepted — takes
  // requests, the same set the owner is shown. It can collect tenants
  // before it is published.
  if (venue.status !== "ACTIVE") throw new MembershipFailure("venue-not-accepting");

  const activeBranches = await db.branch.findMany({
    where: { businessId: input.businessId, isActive: true },
    select: { id: true },
  });
  if (input.branchId) {
    if (!activeBranches.some((b) => b.id === input.branchId)) throw new MembershipFailure("branch-not-yours");
  } else if (activeBranches.length > 1) {
    // A business with several locations is in a venue through the one
    // branch that is there — otherwise the venue would be shown, and
    // would count, the whole chain.
    throw new MembershipFailure("pick-a-branch");
  }

  // The business as a whole and one of its branches cannot both be
  // listed in the same venue: it would appear twice.
  const overlapping = await db.venueMembership.count({
    where: {
      venueId: input.venueId,
      businessId: input.businessId,
      status: { in: ["REQUESTED", "APPROVED"] },
      ...(input.branchId ? { branchId: null } : { branchId: { not: null } }),
    },
  });
  if (overlapping) throw new MembershipFailure("overlaps-existing");

  // A request the venue turned down cannot be sent again for a week.
  const rejected = await db.venueMembership.count({
    where: {
      venueId: input.venueId,
      businessId: input.businessId,
      branchId: input.branchId,
      status: "REJECTED",
      decidedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
    },
  });
  if (rejected) throw new MembershipFailure("recently-rejected");
  try {
    return await db.venueMembership.create({
      data: {
        venueId: input.venueId,
        businessId: input.businessId,
        branchId: input.branchId,
        unit: input.unit,
        requestedById: input.userId,
      },
      select: { id: true, status: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new MembershipFailure("already-live");
    throw e;
  }
}

/** The owner withdraws a request, or leaves a venue. */
export async function withdrawMembership(input: { businessId: string; membershipId: string; userId: string }) {
  const { count } = await db.venueMembership.updateMany({
    where: { id: input.membershipId, businessId: input.businessId, status: { in: ["REQUESTED", "APPROVED"] } },
    data: { status: "REMOVED", decidedById: input.userId, decidedAt: new Date(), decisionNote: "withdrawn by the business" },
  });
  if (count === 0) throw new MembershipFailure("not-found");
}

export type Decision = "approve" | "reject" | "remove" | "place";

const FROM: Record<Decision, ("REQUESTED" | "APPROVED")[]> = {
  approve: ["REQUESTED"],
  reject: ["REQUESTED"],
  remove: ["APPROVED", "REQUESTED"],
  place: ["APPROVED", "REQUESTED"],
};
const TO = { approve: "APPROVED", reject: "REJECTED", remove: "REMOVED" } as const;

/**
 * A venue decides on a membership of its own venue. `place` only moves
 * it to a zone or unit. The zone must be one of this venue's zones.
 */
export async function decideMembership(input: {
  venueId: string;
  membershipId: string;
  decision: Decision;
  userId: string;
  zoneId?: string | null;
  unit?: string | null;
  note?: string | null;
}) {
  if (input.zoneId) {
    const zone = await db.venueZone.findFirst({ where: { id: input.zoneId, venueId: input.venueId }, select: { id: true } });
    if (!zone) throw new MembershipFailure("zone-not-in-venue");
  }
  const existing = await db.venueMembership.findFirst({
    where: { id: input.membershipId, venueId: input.venueId },
    select: { status: true },
  });
  if (!existing) throw new MembershipFailure("not-found");

  const placement = {
    ...(input.zoneId !== undefined ? { zoneId: input.zoneId } : {}),
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
  };
  const data =
    input.decision === "place"
      ? placement
      : {
          ...placement,
          status: TO[input.decision],
          decidedById: input.userId,
          decidedAt: new Date(),
          decisionNote: input.note ?? null,
        };
  // Conditional on the status it was decided from, so two managers
  // deciding at once cannot both win.
  const { count } = await db.venueMembership.updateMany({
    where: { id: input.membershipId, venueId: input.venueId, status: { in: FROM[input.decision] } },
    data,
  });
  if (count === 0) throw new MembershipFailure("invalid-transition");
}

/** Venue-side list: what the business is, never who its customers are. */
export async function listVenueMemberships(venueId: string) {
  const rows = await db.venueMembership.findMany({
    where: { venueId },
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    select: {
      id: true,
      status: true,
      unit: true,
      requestedAt: true,
      decidedAt: true,
      decisionNote: true,
      zone: { select: { id: true, nameAr: true, nameEn: true } },
      branch: { select: { id: true, nameAr: true, nameEn: true, address: true } },
      business: {
        select: {
          id: true,
          slug: true,
          nameAr: true,
          nameEn: true,
          isPublished: true,
          status: true,
          category: { select: { nameAr: true, nameEn: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    requestedAt: r.requestedAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
  }));
}

export const MEMBERSHIP_MESSAGES: Record<MembershipError, { status: number; ar: string }> = {
  "venue-not-found": { status: 404, ar: "المكان ده مش موجود" },
  "venue-not-accepting": { status: 409, ar: "المكان ده مش بيقبل طلبات دلوقتي" },
  "branch-not-yours": { status: 404, ar: "الفرع ده مش تبعك" },
  "already-live": { status: 409, ar: "في طلب أو عضوية قايمة بالفعل للمكان والفرع دول" },
  "not-found": { status: 404, ar: "الطلب ده مش موجود" },
  "invalid-transition": { status: 409, ar: "الطلب اتغير حالته بالفعل — حدّث الصفحة" },
  "zone-not-in-venue": { status: 422, ar: "الدور أو المنطقة دي مش في المكان ده" },
  "pick-a-branch": { status: 422, ar: "نشاطك ليه أكتر من فرع — اختار الفرع اللي جوه المكان" },
  "overlaps-existing": { status: 409, ar: "النشاط كله أو فرع منه معروض أو مطلوب بالفعل في المكان ده" },
  "recently-rejected": { status: 429, ar: "المكان رفض الطلب ده من أقل من أسبوع — كلّم إدارة المكان الأول" },
};
