import type { BusinessStatus } from "@prisma/client";

/**
 * What can be done to a business, and what each thing means.
 *
 * Separated from the route so the rules are readable on their own and
 * testable without a database. Every action names the statuses it may
 * be applied from, so "approve" on an already-approved business is
 * refused rather than writing a second identical audit entry.
 */

export type BusinessAction =
  | "approve"
  | "reject"
  | "suspend"
  | "reinstate"
  | "verify"
  | "unverify"
  | "feature"
  | "unfeature";

/** Actions that change `status`, and what they change it to. */
export const STATUS_RESULT: Partial<Record<BusinessAction, BusinessStatus>> = {
  approve: "APPROVED",
  reject: "REJECTED",
  suspend: "SUSPENDED",
  reinstate: "APPROVED",
};

/** Where each action may be applied from. */
const ALLOWED_FROM: Record<BusinessAction, BusinessStatus[] | "any"> = {
  approve: ["PENDING", "REJECTED"],
  reject: ["PENDING", "APPROVED"],
  // Suspending something already suspended is a no-op that still
  // writes a log line and makes the history harder to read.
  suspend: ["APPROVED", "PENDING"],
  reinstate: ["SUSPENDED"],
  // Verification and featuring are independent of status, but neither
  // belongs on a business that has been rejected or suspended.
  verify: ["APPROVED"],
  unverify: "any",
  feature: ["APPROVED"],
  unfeature: "any",
};

export function canApply(action: BusinessAction, from: BusinessStatus): boolean {
  const allowed = ALLOWED_FROM[action];
  return allowed === "any" || allowed.includes(from);
}

/**
 * Actions that take the page down, and therefore need a reason.
 *
 * An owner who finds their listing gone is owed a sentence saying why.
 * The route refuses these without one.
 */
/**
 * Taking a listing down needs a sentence the owner will read.
 * Verifying one needs the evidence that was checked (a commercial
 * register, a lease, a call to the listed number): the badge says
 * Maw3ed checked who runs this business, so the record says how.
 */
export const REQUIRES_REASON: BusinessAction[] = ["reject", "suspend", "verify"];

/** Whether this action should also change isPublished, and to what. */
export function publishedAfter(
  action: BusinessAction,
  current: boolean,
): boolean {
  switch (action) {
    // Taking a business down has to actually take it down; leaving
    // isPublished true would suspend it in the admin panel and nowhere
    // a customer can see.
    case "reject":
    case "suspend":
      return false;
    // Approving does not publish. The owner still has to verify their
    // email, which is what isPublished has always meant — approving
    // somebody past their own onboarding would be surprising.
    default:
      return current;
  }
}

export const ACTION_LABELS: Record<BusinessAction, { ar: string; verb: string }> = {
  approve: { ar: "قبول", verb: "business.approve" },
  reject: { ar: "رفض", verb: "business.reject" },
  suspend: { ar: "إيقاف", verb: "business.suspend" },
  reinstate: { ar: "إرجاع", verb: "business.reinstate" },
  verify: { ar: "توثيق", verb: "business.verify" },
  unverify: { ar: "إلغاء التوثيق", verb: "business.unverify" },
  feature: { ar: "تمييز", verb: "business.feature" },
  unfeature: { ar: "إلغاء التمييز", verb: "business.unfeature" },
};

export const STATUS_LABELS: Record<BusinessStatus, { ar: string; tone: "ok" | "warn" | "danger" | "muted" }> = {
  PENDING: { ar: "بانتظار المراجعة", tone: "warn" },
  APPROVED: { ar: "مقبول", tone: "ok" },
  REJECTED: { ar: "مرفوض", tone: "danger" },
  SUSPENDED: { ar: "موقوف", tone: "danger" },
};
