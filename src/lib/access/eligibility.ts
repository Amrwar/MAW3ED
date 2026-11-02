/**
 * Who may request entry to a venue, for how long, through which gates.
 *
 * Pure: the caller loads the booking, the venue listing, the venue's
 * policy and the visitor; this decides. A confirmed booking is NOT a
 * pass: this decides only that the visitor may ASK the venue's access
 * provider for one. An entitlement exists only when every condition holds:
 *
 *   - the booking is CONFIRMED, ARRIVED or IN_PROGRESS (a pending,
 *     cancelled, failed, no-show or test booking never is);
 *   - the business is open for business (not suspended or closed);
 *   - the business — or the booking's branch — is APPROVED in an ACTIVE
 *     venue (lib/venues/pause.ts has the same branch rule);
 *   - the venue has visitor passes switched on with a usable provider,
 *     and its policy admits visitors by booking;
 *   - the visitor is the holder, or a named guest within the venue's
 *     guest limit, and carries the identity the venue requires;
 *   - the window — from `accessBeforeMinutes` before the appointment to
 *     `accessAfterMinutes` after it — has not passed, and the venue's
 *     no-show rule has not run out for somebody who never came.
 *
 * Returns SUSPENDED (not revoked) when the venue has suspended visitor
 * access, or is closed, on the appointment's day: the right comes back
 * when the suspension ends.
 *
 * Every time here is a real instant (not the wall-clock frame bookings
 * are stored in); lib/access/passes.ts converts before calling.
 */

export const ACCESS_BOOKING_STATES: readonly string[] = ["CONFIRMED", "ARRIVED", "IN_PROGRESS"];

export interface AccessPolicy {
  visitorEligibility: string;
  accessBeforeMinutes: number;
  accessAfterMinutes: number;
  maxGuestsPerBooking: number;
  reentryAllowed: boolean;
  allowedGateIds: string[];
  identityRequirement: "NAME" | "NAME_AND_PHONE";
  lateEntryCutoffMinutes: number | null;
  noShowRevokeMinutes: number | null;
}

export interface EligibilityInput {
  booking: { status: string; isTest: boolean; startsAt: Date | null; endsAt: Date | null; branchId: string | null };
  business: { status: string };
  /** Approved listings of this business in this venue (branchId null = whole business). */
  listings: { branchId: string | null }[];
  activeBranchCount: number;
  venue: { status: string; accessEnabled: boolean; providerUsable: boolean };
  policy: AccessPolicy | null;
  visitor: { role: "HOLDER" | "GUEST"; displayName: string; phoneE164: string | null; removed: boolean };
  /** 0-based position among this booking's live guests (holder excluded). */
  guestIndex: number;
  /** The venue has an ACCESS_SUSPENDED or CLOSED notice covering the appointment's day. */
  accessSuspended: boolean;
  /** Somebody on this booking has been let in, or the business checked them in. */
  arrived: boolean;
  now: Date;
}

export type EligibilityDecision =
  | {
      status: "ELIGIBLE" | "SUSPENDED";
      reason: string | null;
      validFrom: Date;
      validUntil: Date;
      entryUntil: Date | null;
      allowedGateIds: string[];
      reentryAllowed: boolean;
    }
  | { status: "EXPIRED" | "INELIGIBLE"; reason: string };

const MIN = 60_000;

/** Business statuses that may receive visitors. */
const OPEN_BUSINESS = new Set(["APPROVED"]);

export function decideAccess(i: EligibilityInput): EligibilityDecision {
  const no = (reason: string): EligibilityDecision => ({ status: "INELIGIBLE", reason });
  const b = i.booking;

  if (b.isTest) return no("test-booking");
  if (i.visitor.removed) return no("guest-removed");
  if (b.status === "COMPLETED") return { status: "EXPIRED", reason: "booking-completed" };
  if (!ACCESS_BOOKING_STATES.includes(b.status)) return no(`booking-${b.status.toLowerCase()}`);
  if (!b.startsAt || !b.endsAt) return no("booking-without-time");
  if (!OPEN_BUSINESS.has(i.business.status)) return no("business-unavailable");

  const covered = i.listings.some(
    (l) => l.branchId === null || (b.branchId !== null && l.branchId === b.branchId) || (b.branchId === null && i.activeBranchCount <= 1),
  );
  if (!covered) return no("business-not-listed-in-venue");
  if (i.venue.status !== "ACTIVE") return no("venue-not-active");
  if (!i.venue.accessEnabled) return no("venue-access-off");
  if (!i.venue.providerUsable) return no("no-usable-provider");
  const p = i.policy;
  if (!p || p.visitorEligibility !== "BOOKING_REQUIRED") return no("policy-does-not-admit-by-booking");

  if (i.visitor.role === "GUEST" && i.guestIndex >= p.maxGuestsPerBooking) return no("over-guest-limit");
  if (!i.visitor.displayName.trim()) return no("name-required");
  if (p.identityRequirement === "NAME_AND_PHONE" && !i.visitor.phoneE164) return no("phone-required");

  const validFrom = new Date(b.startsAt.getTime() - p.accessBeforeMinutes * MIN);
  const validUntil = new Date(b.endsAt.getTime() + p.accessAfterMinutes * MIN);
  if (i.now >= validUntil) return { status: "EXPIRED", reason: "window-passed" };
  if (
    p.noShowRevokeMinutes !== null &&
    b.status === "CONFIRMED" &&
    !i.arrived &&
    i.now.getTime() >= b.startsAt.getTime() + p.noShowRevokeMinutes * MIN
  ) {
    return { status: "EXPIRED", reason: "no-show-cutoff" };
  }
  const entryUntil = p.lateEntryCutoffMinutes === null ? null : new Date(b.startsAt.getTime() + p.lateEntryCutoffMinutes * MIN);

  return {
    status: i.accessSuspended ? "SUSPENDED" : "ELIGIBLE",
    reason: i.accessSuspended ? "venue-access-suspended" : null,
    validFrom,
    validUntil,
    entryUntil: entryUntil && entryUntil < validUntil ? entryUntil : null,
    allowedGateIds: p.allowedGateIds,
    reentryAllowed: p.reentryAllowed,
  };
}

/** What the visitor's own screen calls each reason. */
export const REASON_TEXT: Record<string, [ar: string, en: string]> = {
  "test-booking": ["حجز تجريبي — مفيش تصريح دخول", "Test booking — no visitor pass"],
  "guest-removed": ["اتشال من الحجز", "Removed from the booking"],
  "booking-completed": ["الميعاد خلص", "The appointment is over"],
  "booking-pending": ["الحجز لسه مستني تأكيد المكان", "The booking is waiting for the business to confirm"],
  "booking-pending_payment": ["الحجز مستني الدفع", "The booking is waiting for payment"],
  "booking-cancelled": ["الحجز اتلغى", "The booking was cancelled"],
  "booking-no_show": ["اتسجل إنك محضرتش", "Recorded as a no-show"],
  "booking-failed_payment": ["الدفع مكملش", "The payment did not complete"],
  "booking-without-time": ["الحجز من غير ميعاد محدد", "The booking has no set time"],
  "business-unavailable": ["المكان مش بيستقبل حجوزات دلوقتي", "The business is not open for bookings right now"],
  "business-not-listed-in-venue": ["المكان ده مش معروض في المول", "This business is not listed in the venue"],
  "venue-not-active": ["المول مش شغال حاليًا", "The venue is not active"],
  "venue-access-off": ["تصاريح الدخول مش متاحة في المكان ده", "Visitor passes are not offered at this venue"],
  "no-usable-provider": ["تصاريح الدخول مش متاحة لسه", "Visitor passes are not available yet"],
  "policy-does-not-admit-by-booking": ["الدخول هنا مش بالحجز — اتبع تعليمات المكان", "Entry here is not by booking — follow the venue's instructions"],
  "over-guest-limit": ["أكتر من عدد المرافقين المسموح", "Over the venue's guest limit"],
  "name-required": ["لازم اسم", "A name is required"],
  "phone-required": ["المكان بيطلب رقم موبايل", "The venue requires a phone number"],
  "window-passed": ["وقت الدخول خلص", "The access window has passed"],
  "no-show-cutoff": ["عدّى وقت الحضور المسموح من غير ما تيجي", "The venue's arrival cut-off passed before you arrived"],
  "venue-access-suspended": ["دخول الزوار موقوف من إدارة المكان في اليوم ده", "The venue has suspended visitor access that day"],
  "security-override": ["إدارة الأمن وقفت التصريح", "Suspended by the venue's security"],
  "booking-changed": ["الحجز اتغيّر — التصريح بيتحدّث", "The booking changed — the pass is being updated"],
};

export function reasonText(reason: string | null | undefined, en: boolean): string | null {
  if (!reason) return null;
  const t = REASON_TEXT[reason];
  return t ? (en ? t[1] : t[0]) : reason;
}
